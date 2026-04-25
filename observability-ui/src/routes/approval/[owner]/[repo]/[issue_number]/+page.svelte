<script lang="ts">
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import { base } from "$app/paths";
	import { getAccessToken, login } from "$lib/auth";
	import { marked } from "marked";

	let owner = $derived(page.params.owner);
	let repo = $derived(page.params.repo);
	let issueNumber = $derived(page.params.issue_number);

	let loading = $state(true);
	let actionLoading = $state(false);
	let error = $state<string | null>(null);
	let issue = $state<any>(null);
	let pr = $state<any>(null);
	let markdownArtifacts = $state<{ filename: string; html: string }[]>([]);
	let commentText = $state("");

	// GraphQL IDs
	const PROJECT_ID = "PVT_kwDOEGPutc4BUN0D";
	const STATUS_FIELD_ID = "PVTSSF_lADOEGPutc4BUN0DzhBXf98";
	const PERSONA_FIELD_ID = "PVTSSF_lADOEGPutc4BUN0DzhBbZaw";
	const STATUS_DONE_ID = "98236657";
	const STATUS_IN_PROGRESS_ID = "47fc9ee4";
	const STATUS_TODO_ID = "f75ad846";
	const PERSONA_CONDUCTOR_ID = "e1ea423a";

	let itemId = $state<string | null>(null);
	let issueNodeId = $state<string | null>(null);

	onMount(async () => {
		const token = getAccessToken();
		if (!token) {
			login();
			return;
		}

		try {
			// 1. Fetch issue details and find the Project Item ID
			const issueRes = await fetch("https://api.github.com/graphql", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: `
						query {
							repository(owner: "${owner}", name: "${repo}") {
								issue(number: ${issueNumber}) {
									id
									title
									body
									projectItems(first: 10) {
										nodes {
											id
											project {
												id
											}
										}
									}
								}
							}
						}
					`,
				}),
			});

			if (!issueRes.ok) throw new Error("Failed to fetch issue details");
			const issueJson = await issueRes.json();
			if (issueJson.errors) throw new Error(issueJson.errors[0].message);

			issue = issueJson.data.repository.issue;
			issueNodeId = issue.id;

			const projectItem = issue.projectItems.nodes.find(
				(n: any) => n.project.id === PROJECT_ID
			);
			if (projectItem) {
				itemId = projectItem.id;
			}

			// 2. Find Linked PR
			const prsRes = await fetch(
				`https://api.github.com/repos/${owner}/${repo}/pulls?state=open`,
				{
					headers: { Authorization: `Bearer ${token}` },
				}
			);
			if (prsRes.ok) {
				const openPrs = await prsRes.json();
				// Find PR linked by branch name, title, or body
				pr = openPrs.find(
					(p: any) =>
						p.head.ref.includes(issueNumber.toString()) ||
						p.title.includes(`#${issueNumber}`) ||
						(p.body && p.body.includes(`#${issueNumber}`))
				);
			}

			// 3. Fetch PR Files and Markdown Artifacts
			if (pr) {
				const filesRes = await fetch(
					`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/files`,
					{
						headers: { Authorization: `Bearer ${token}` },
					}
				);
				if (filesRes.ok) {
					const files = await filesRes.json();
					const mdFiles = files.filter(
						(f: any) =>
							f.filename.endsWith(".md") && f.status !== "removed"
					);

					for (const f of mdFiles) {
						const rawRes = await fetch(f.raw_url, {
							headers: { Authorization: `Bearer ${token}` },
						});
						if (rawRes.ok) {
							const rawContent = await rawRes.text();
							const htmlContent = await marked.parse(rawContent);
							markdownArtifacts = [
								...markdownArtifacts,
								{ filename: f.filename, html: htmlContent },
							];
						}
					}
				}
			}
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	});

	async function updateProjectItem(
		token: string,
		statusOptionId: string,
		personaOptionId?: string
	) {
		if (!itemId) return;

		let mutations = `
			updateStatus: updateProjectV2ItemFieldValue(
				input: {
					projectId: "${PROJECT_ID}"
					itemId: "${itemId}"
					fieldId: "${STATUS_FIELD_ID}"
					value: { singleSelectOptionId: "${statusOptionId}" }
				}
			) { clientMutationId }
		`;

		if (personaOptionId) {
			mutations += `
				updatePersona: updateProjectV2ItemFieldValue(
					input: {
						projectId: "${PROJECT_ID}"
						itemId: "${itemId}"
						fieldId: "${PERSONA_FIELD_ID}"
						value: { singleSelectOptionId: "${personaOptionId}" }
					}
				) { clientMutationId }
			`;
		} else {
			// Clear persona
			mutations += `
				clearPersona: clearProjectV2ItemFieldValue(
					input: {
						projectId: "${PROJECT_ID}"
						itemId: "${itemId}"
						fieldId: "${PERSONA_FIELD_ID}"
					}
				) { clientMutationId }
			`;
		}

		const res = await fetch("https://api.github.com/graphql", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query: `mutation { ${mutations} }` }),
		});

		if (!res.ok) throw new Error("Failed to update project item");
		const json = await res.json();
		if (json.errors) throw new Error(json.errors[0].message);
	}

	async function updateIssueLabels(token: string, newPersonaLabel?: string, removeBranchLabel: boolean = false) {
		// Fetch current labels
		const res = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);
		if (!res.ok) throw new Error("Failed to fetch labels");
		const labels = await res.json();

		const labelNames = labels.map((l: any) => l.name);
		const filteredLabels = labelNames.filter(
			(l: string) => {
				if (l.startsWith("persona:")) return false;
				if (removeBranchLabel && l.startsWith("branch:")) return false;
				return true;
			}
		);

		if (newPersonaLabel) {
			filteredLabels.push(`persona: ${newPersonaLabel}`);
		}

		// Update labels
		const updateRes = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
			{
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ labels: filteredLabels }),
			}
		);
		if (!updateRes.ok) throw new Error("Failed to update labels");
	}

	async function addComment(token: string) {
		if (!commentText.trim()) return;
		const res = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ body: commentText }),
			}
		);
		if (!res.ok) throw new Error("Failed to add comment");
	}

	async function handleApprove() {
		const token = getAccessToken();
		if (!token) return login();
		actionLoading = true;
		error = null;

		try {
			if (pr) {
				const res = await fetch(
					`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/merge`,
					{
						method: "PUT",
						headers: { Authorization: `Bearer ${token}` },
					}
				);
				if (!res.ok) {
					const json = await res.json();
					throw new Error(json.message || "Failed to merge PR");
				}
			}

			await updateProjectItem(token, STATUS_DONE_ID);
			await updateIssueLabels(token, undefined, true); // Clears persona and branch labels

			window.location.href = `${base}/approval`;
		} catch (e: any) {
			error = e.message;
			actionLoading = false;
		}
	}

	async function handleCommentAndInProgress() {
		const token = getAccessToken();
		if (!token) return login();
		if (!commentText.trim()) {
			error = "Please enter a comment.";
			return;
		}
		actionLoading = true;
		error = null;

		try {
			await addComment(token);
			await updateProjectItem(token, STATUS_IN_PROGRESS_ID, PERSONA_CONDUCTOR_ID);
			await updateIssueLabels(token, "conductor");

			window.location.href = `${base}/approval`;
		} catch (e: any) {
			error = e.message;
			actionLoading = false;
		}
	}

	async function handleBackToTodo() {
		const token = getAccessToken();
		if (!token) return login();
		actionLoading = true;
		error = null;

		try {
			if (commentText.trim()) {
				await addComment(token);
			}
			await updateProjectItem(token, STATUS_TODO_ID);
			await updateIssueLabels(token); // Clears persona and branch labels

			window.location.href = `${base}/approval`;
		} catch (e: any) {
			error = e.message;
			actionLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Review Issue #{issueNumber}</title>
</svelte:head>

<div class="container">
	<nav>
		<a href="{base}/approval">← Back to Queue</a>
	</nav>

	{#if loading}
		<p>Loading...</p>
	{:else if error && !issue}
		<p class="error">{error}</p>
	{:else}
		<header>
			<h1>Issue #{issueNumber}: {issue?.title}</h1>
			<p class="repo-info">{owner}/{repo}</p>
		</header>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<div class="content-wrapper">
			<section class="details">
				<h2>Issue Details</h2>
				<div class="issue-body">
					{#if issue?.body}
						<pre>{issue.body}</pre>
					{:else}
						<p class="empty-state">No description provided.</p>
					{/if}
				</div>

				<h2>Linked Pull Request</h2>
				{#if pr}
					<div class="pr-info">
						<a href={pr.html_url} target="_blank" rel="noopener noreferrer">
							#{pr.number} {pr.title}
						</a>
						<span class="status-badge {pr.state}">{pr.state}</span>
					</div>

					<div class="artifacts">
						<h3>Markdown Artifacts ({markdownArtifacts.length})</h3>
						{#if markdownArtifacts.length > 0}
							{#each markdownArtifacts as artifact}
								<details class="artifact-details">
									<summary>{artifact.filename}</summary>
									<div class="markdown-content">
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										{@html artifact.html}
									</div>
								</details>
							{/each}
						{:else}
							<p class="empty-state">No markdown files found in this PR.</p>
						{/if}
					</div>
				{:else}
					<p class="empty-state">No linked open Pull Request found.</p>
				{/if}
			</section>

			<aside class="actions-panel">
				<h2>Review Actions</h2>
				
				<div class="action-group">
					<button 
						class="btn btn-primary btn-block" 
						onclick={handleApprove} 
						disabled={actionLoading}
					>
						Approve & Merge
					</button>
					<p class="help-text">Merges PR and moves to Done.</p>
				</div>

				<div class="divider"></div>

				<div class="action-group">
					<label for="comment">Feedback / Comment</label>
					<textarea 
						id="comment" 
						bind:value={commentText} 
						placeholder="Add a comment to the issue..."
						rows="4"
						disabled={actionLoading}
					></textarea>
				</div>

				<div class="action-group">
					<button 
						class="btn btn-secondary btn-block" 
						onclick={handleCommentAndInProgress} 
						disabled={actionLoading || !commentText.trim()}
					>
						Comment & Back to In Progress
					</button>
					<p class="help-text">Assigns back to conductor to address feedback.</p>
				</div>

				<div class="action-group">
					<button 
						class="btn btn-outline btn-block" 
						onclick={handleBackToTodo} 
						disabled={actionLoading}
					>
						Back to TODO
					</button>
					<p class="help-text">Moves to Todo state. (Comment optional)</p>
				</div>
			</aside>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	nav {
		margin-bottom: 2rem;
	}

	nav a {
		color: #2563eb;
		text-decoration: none;
	}

	header {
		margin-bottom: 2rem;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 1.875rem;
	}

	.repo-info {
		color: #6b7280;
		margin: 0.5rem 0 0 0;
	}

	.content-wrapper {
		display: grid;
		grid-template-columns: 1fr 350px;
		gap: 2rem;
		align-items: start;
	}

	.details h2 {
		margin-top: 0;
		font-size: 1.25rem;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 0.5rem;
	}

	.issue-body {
		background: #f9fafb;
		padding: 1rem;
		border-radius: 0.5rem;
		border: 1px solid #e5e7eb;
		margin-bottom: 2rem;
	}

	.issue-body pre {
		white-space: pre-wrap;
		font-family: inherit;
		margin: 0;
	}

	.empty-state {
		color: #6b7280;
		font-style: italic;
	}

	.pr-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
		padding: 1rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 0.5rem;
	}

	.pr-info a {
		font-weight: 600;
		color: #1e40af;
		text-decoration: none;
	}

	.pr-info a:hover {
		text-decoration: underline;
	}

	.status-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.open {
		background: #dcfce7;
		color: #166534;
	}

	.artifacts h3 {
		font-size: 1.125rem;
		margin-bottom: 1rem;
	}

	.artifact-details {
		margin-bottom: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.artifact-details summary {
		padding: 1rem;
		background: #f9fafb;
		cursor: pointer;
		font-weight: 600;
		user-select: none;
	}

	.artifact-details summary:hover {
		background: #f3f4f6;
	}

	.markdown-content {
		padding: 1.5rem;
		background: #fff;
		border-top: 1px solid #e5e7eb;
	}

	.actions-panel {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 1.5rem;
		position: sticky;
		top: 2rem;
	}

	.actions-panel h2 {
		margin-top: 0;
		font-size: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.action-group {
		margin-bottom: 1.5rem;
	}

	.action-group:last-child {
		margin-bottom: 0;
	}

	label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		resize: vertical;
		font-family: inherit;
		box-sizing: border-box;
	}

	.btn {
		padding: 0.75rem 1rem;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		transition: background-color 0.2s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-block {
		display: block;
		width: 100%;
	}

	.btn-primary {
		background: #16a34a;
		color: #fff;
	}

	.btn-primary:hover:not(:disabled) {
		background: #15803d;
	}

	.btn-secondary {
		background: #2563eb;
		color: #fff;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn-outline {
		background: transparent;
		border: 1px solid #d1d5db;
		color: #374151;
	}

	.btn-outline:hover:not(:disabled) {
		background: #f3f4f6;
	}

	.help-text {
		font-size: 0.75rem;
		color: #6b7280;
		margin: 0.5rem 0 0 0;
		text-align: center;
	}

	.divider {
		height: 1px;
		background: #e5e7eb;
		margin: 1.5rem 0;
	}

	.error {
		color: #991b1b;
		padding: 1rem;
		background: #fee2e2;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
	}

	@media (max-width: 768px) {
		.content-wrapper {
			grid-template-columns: 1fr;
		}
	}
</style>
