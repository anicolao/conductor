<script lang="ts">
import { marked } from "marked";
import { onMount } from "svelte";
import { base } from "$app/paths";
import { page } from "$app/state";
import { getAccessToken, login } from "$lib/auth";

interface LabelNode {
	name: string;
}

interface ProjectItemNode {
	id: string;
}

interface RepositorySettings {
	mergeCommitAllowed: boolean;
	squashMergeAllowed: boolean;
	rebaseMergeAllowed: boolean;
}

interface PullRequestSource {
	number: number;
	url: string;
	state: string;
	baseRepository: {
		owner: { login: string };
		name: string;
	};
}

interface TimelineNode {
	source?: PullRequestSource;
}

interface GitHubIssueDetails {
	id: string;
	title: string;
	body: string;
	labels: { nodes: LabelNode[] };
	projectItems: { nodes: ProjectItemNode[] };
	timelineItems: { nodes: TimelineNode[] };
}

interface MarkdownFile {
	filename: string;
	raw_url: string;
	content: string;
}

interface PullRequestWithArtifacts extends PullRequestSource {
	repositorySettings: RepositorySettings;
	markdownFiles: MarkdownFile[];
}

const owner = $derived(page.params.owner);
const repo = $derived(page.params.repo);
const issue_number = $derived(page.params.issue_number);

let issue = $state<GitHubIssueDetails | null>(null);
let pullRequests = $state<PullRequestWithArtifacts[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);
let commentText = $state("");
let actionLoading = $state(false);

const PROJECT_ID = "PVT_kwDOEGPutc4BUN0D";
const STATUS_FIELD_ID = "PVTSSF_lADOEGPutc4BUN0DzhBXf98";
const PERSONA_FIELD_ID = "PVTSSF_lADOEGPutc4BUN0DzhBbZaw";

const STATUS_OPTIONS = {
	TODO: "f75ad846",
	IN_PROGRESS: "47fc9ee4",
	HUMAN_REVIEW: "0fd775be",
	DONE: "98236657",
};

const PERSONA_OPTIONS = {
	CONDUCTOR: "e1ea423a",
	CODER: "ea5e8807",
};

onMount(async () => {
	const token = getAccessToken();
	if (!token) {
		login();
		return;
	}

	try {
		await fetchData(token);
	} catch (e: unknown) {
		console.error(e);
		error = e instanceof Error ? e.message : String(e);
	} finally {
		loading = false;
	}
});

async function fetchData(token: string) {
	const o = owner;
	const r = repo;
	const n = issue_number;

	if (!o || !r || !n) {
		throw new Error("Missing route parameters");
	}

	// Fetch issue and find linked PR via GraphQL
	const query = `
		query IssueDetails($owner: String!, $repo: String!, $number: Int!) {
			repository(owner: $owner, name: $repo) {
				mergeCommitAllowed
				squashMergeAllowed
				rebaseMergeAllowed
				issue(number: $number) {
					id
					title
					body
					labels(first: 20) {
						nodes { name }
					}
					projectItems(first: 10) {
						nodes {
							id
						}
					}
					timelineItems(first: 50, itemTypes: [CROSS_REFERENCED_EVENT]) {
						nodes {
							... on CrossReferencedEvent {
								source {
									... on PullRequest {
										number
										url
										state
										baseRepository {
											owner { login }
											name
										}
									}
								}
							}
						}
					}
				}
			}
		}
	`;

	const res = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query,
			variables: {
				owner: o,
				repo: r,
				number: parseInt(n, 10),
			},
		}),
	});

	const result = await res.json();
	if (result.errors) throw new Error(result.errors[0].message);

	const repository = result.data.repository;
	issue = repository.issue as GitHubIssueDetails;
	if (!issue) throw new Error("Issue not found");

	// Find all unique PRs
	const prNodes = issue.timelineItems.nodes
		.filter((n: TimelineNode) => n.source?.number)
		.map((n: TimelineNode) => {
			return {
				...(n.source as PullRequestSource),
				repositorySettings: {
					mergeCommitAllowed: repository.mergeCommitAllowed,
					squashMergeAllowed: repository.squashMergeAllowed,
					rebaseMergeAllowed: repository.rebaseMergeAllowed,
				},
			};
		});

	const uniquePrs = new Map<
		number,
		PullRequestSource & { repositorySettings: RepositorySettings }
	>();
	for (const pr of prNodes) {
		uniquePrs.set(pr.number, pr);
	}

	pullRequests = await Promise.all(
		Array.from(uniquePrs.values()).map(async (pr) => {
			// Fetch PR files
			const filesRes = await fetch(
				`https://api.github.com/repos/${pr.baseRepository.owner.login}/${pr.baseRepository.name}/pulls/${pr.number}/files`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			if (!filesRes.ok)
				throw new Error(`Failed to fetch PR files for #${pr.number}`);
			const files = (await filesRes.json()) as {
				filename: string;
				contents_url: string;
				raw_url: string;
			}[];

			const mdFiles = files.filter((f) => f.filename.endsWith(".md"));

			// Fetch content for each md file
			const markdownFiles = await Promise.all(
				mdFiles.map(async (file) => {
					const contentRes = await fetch(file.contents_url, {
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: "application/vnd.github.v3.raw",
						},
					});
					const content = await contentRes.text();
					const parsedHtml = marked.parse(content) as string;
					return {
						filename: file.filename,
						raw_url: file.raw_url,
						content: resolveRelativeUrls(parsedHtml, file.raw_url),
					};
				}),
			);

			return {
				...pr,
				markdownFiles,
			};
		}),
	);
}

function resolveRelativeUrls(html: string, baseUrl: string): string {
	const decodedBaseUrl = decodeURIComponent(baseUrl);
	return html.replace(/(src|href)=["']([^"']+)["']/g, (match, attr, val) => {
		// Skip if it's already an absolute URL or special protocol
		if (/^(https?:\/\/|\/|#|mailto:|data:)/i.test(val)) {
			return match;
		}

		try {
			return `${attr}="${new URL(val, decodedBaseUrl).href}"`;
		} catch (e) {
			return match;
		}
	});
}

async function updateProjectField(fieldId: string, optionId: string | null) {
	const token = getAccessToken();
	const projectItemId = issue?.projectItems.nodes[0]?.id;
	if (!projectItemId) return;

	let query: string;
	let variables: Record<string, unknown>;

	if (optionId) {
		query = `
			mutation UpdateField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
				updateProjectV2ItemFieldValue(input: {
					projectId: $projectId,
					itemId: $itemId,
					fieldId: $fieldId,
					value: { singleSelectOptionId: $optionId }
				}) {
					projectV2Item { id }
				}
			}
		`;
		variables = {
			projectId: PROJECT_ID,
			itemId: projectItemId,
			fieldId: fieldId,
			optionId: optionId,
		};
	} else {
		query = `
			mutation ClearField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
				clearProjectV2ItemFieldValue(input: {
					projectId: $projectId,
					itemId: $itemId,
					fieldId: $fieldId
				}) {
					projectV2Item { id }
				}
			}
		`;
		variables = {
			projectId: PROJECT_ID,
			itemId: projectItemId,
			fieldId: fieldId,
		};
	}

	const res = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ query, variables }),
	});
	const result = await res.json();
	if (result.errors) throw new Error(result.errors[0].message);
}

async function updateLabels(add: string[], remove: string[]) {
	const o = owner;
	const r = repo;
	const n = issue_number;
	if (!o || !r || !n) throw new Error("Missing route parameters");
	if (!issue) throw new Error("Issue data not found");

	const token = getAccessToken();
	const currentLabels = issue.labels.nodes.map((l: LabelNode) => l.name);
	let newLabels = currentLabels.filter((l: string) => !remove.includes(l));
	for (const label of add) {
		if (!newLabels.includes(label)) {
			newLabels.push(label);
		}
	}

	const res = await fetch(
		`https://api.github.com/repos/${o}/${r}/issues/${n}/labels`,
		{
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ labels: newLabels }),
		},
	);
	if (!res.ok) throw new Error("Failed to update labels");
}

async function addComment(text: string) {
	const o = owner;
	const r = repo;
	const n = issue_number;
	if (!o || !r || !n) throw new Error("Missing route parameters");

	const token = getAccessToken();
	const res = await fetch(
		`https://api.github.com/repos/${o}/${r}/issues/${n}/comments`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ body: text }),
		},
	);
	if (!res.ok) throw new Error("Failed to add comment");
}

async function handleApprove() {
	if (!confirm("Are you sure you want to approve and merge?")) return;
	if (!issue) return;
	actionLoading = true;
	try {
		const token = getAccessToken();

		// Add comment
		await addComment("Approved");

		// Merge PR if exactly one exists
		const pullRequest = pullRequests.length === 1 ? pullRequests[0] : null;

		if (pullRequest && pullRequest.state === "OPEN") {
			let mergeMethod = "merge";
			if (pullRequest.repositorySettings.squashMergeAllowed) {
				mergeMethod = "squash";
			} else if (pullRequest.repositorySettings.rebaseMergeAllowed) {
				mergeMethod = "rebase";
			} else if (pullRequest.repositorySettings.mergeCommitAllowed) {
				mergeMethod = "merge";
			}

			const mergeRes = await fetch(
				`https://api.github.com/repos/${pullRequest.baseRepository.owner.login}/${pullRequest.baseRepository.name}/pulls/${pullRequest.number}/merge`,
				{
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ merge_method: mergeMethod }),
				},
			);
			if (!mergeRes.ok) {
				const errorData = await mergeRes.json();
				throw new Error(`Failed to merge PR: ${errorData.message}`);
			}
		}

		// Update status to Done
		await updateProjectField(STATUS_FIELD_ID, STATUS_OPTIONS.DONE);

		// Clear persona field
		await updateProjectField(PERSONA_FIELD_ID, null);

		// Remove persona and branch labels
		const labelsToRemove = issue.labels.nodes
			.map((l: LabelNode) => l.name)
			.filter(
				(name: string) =>
					name.startsWith("persona:") || name.startsWith("branch:"),
			);
		await updateLabels([], labelsToRemove);

		alert("Approved and merged successfully!");
		window.location.href = `${base}/approval`;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		alert(msg);
	} finally {
		actionLoading = false;
	}
}

async function handleCommentInProgress() {
	if (!commentText.trim()) {
		alert("Please enter a comment.");
		return;
	}
	if (!issue) return;
	actionLoading = true;
	try {
		await addComment(commentText);
		await updateProjectField(STATUS_FIELD_ID, STATUS_OPTIONS.IN_PROGRESS);

		// Update persona field to conductor
		await updateProjectField(PERSONA_FIELD_ID, PERSONA_OPTIONS.CONDUCTOR);

		// Set persona: conductor label
		const labelsToRemove = issue.labels.nodes
			.map((l: LabelNode) => l.name)
			.filter(
				(name: string) =>
					name.startsWith("persona:") && name !== "persona: conductor",
			);
		await updateLabels(["persona: conductor"], labelsToRemove);

		alert("Comment added and moved back to In Progress.");
		window.location.href = `${base}/approval`;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		alert(msg);
	} finally {
		actionLoading = false;
	}
}

async function handleBackToTodo() {
	if (!issue) return;
	actionLoading = true;
	try {
		if (commentText.trim()) {
			await addComment(commentText);
		}
		await updateProjectField(STATUS_FIELD_ID, STATUS_OPTIONS.TODO);

		// Clear persona field
		await updateProjectField(PERSONA_FIELD_ID, null);

		// Remove persona labels
		const labelsToRemove = issue.labels.nodes
			.map((l: LabelNode) => l.name)
			.filter((name: string) => name.startsWith("persona:"));
		await updateLabels([], labelsToRemove);

		alert("Moved back to Todo.");
		window.location.href = `${base}/approval`;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		alert(msg);
	} finally {
		actionLoading = false;
	}
}
</script>

<svelte:head>
	<title>Approve Issue #{issue_number}</title>
</svelte:head>

<div class="container">
	<nav>
		<a href="{base}/approval">← Back to Approval Queue</a>
	</nav>

	{#if loading}
		<p>Loading details...</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else}
		<header>
			<h1>{issue.title} <span class="issue-number">#{issue_number}</span></h1>
			<p class="repo-name">{owner}/{repo}</p>
		</header>

		{#if pullRequests.length > 1}
			<div class="warning">
				<p><strong>Multiple pull requests are linked to this issue.</strong></p>
				<p>Please approve and merge them manually on GitHub. The "Approve & Merge" button is disabled to avoid ambiguity.</p>
			</div>
		{/if}

		{#each pullRequests as pr}
			<section class="artifacts">
				<h2>PR #{pr.number} Artifacts</h2>
				<p class="pr-link">
					<a href={pr.url} target="_blank" rel="noopener noreferrer">
						View PR #{pr.number} on GitHub
					</a>
				</p>
				{#if pr.markdownFiles.length > 0}
					{#each pr.markdownFiles as file}
						<details class="artifact-card">
							<summary>{file.filename}</summary>
							<div class="markdown-content">
								{@html file.content}
							</div>
						</details>
					{/each}
				{:else}
					<p class="info">No markdown artifacts found in PR #{pr.number}.</p>
				{/if}
			</section>
		{/each}

		{#if pullRequests.length === 0}
			<p class="info">No linked pull requests found.</p>
		{/if}

		<section class="actions">
			<h2>Actions</h2>
			
			<div class="comment-area">
				<label for="comment">Comment (Required for "In Progress", Optional for "Todo")</label>
				<textarea 
					id="comment" 
					bind:value={commentText} 
					placeholder="Add your feedback here..."
					disabled={actionLoading}
				></textarea>
			</div>

			<div class="button-group">
				{#if pullRequests.length <= 1}
					<button 
						class="btn approve" 
						onclick={handleApprove} 
						disabled={actionLoading}
					>
						{actionLoading ? 'Processing...' : 'Approve & Merge'}
					</button>
				{/if}
				
				<button 
					class="btn in-progress" 
					onclick={handleCommentInProgress} 
					disabled={actionLoading || !commentText.trim()}
				>
					Comment & Move to In Progress
				</button>

				<button 
					class="btn todo" 
					onclick={handleBackToTodo} 
					disabled={actionLoading}
				>
					Back to TODO
				</button>
			</div>
		</section>
	{/if}
</div>

<style>
	.container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		h1 {
			font-size: 1.5rem !important;
		}

		.button-group {
			flex-direction: column;
		}

		.btn {
			width: 100%;
			text-align: center;
		}

		.artifact-card summary {
			padding: 0.75rem;
		}
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

	.issue-number {
		color: #6b7280;
		font-weight: 400;
	}

	.repo-name {
		color: #4b5563;
		margin-top: 0.25rem;
	}

	h2 {
		font-size: 1.25rem;
		margin-top: 2rem;
		margin-bottom: 1rem;
		color: #374151;
	}

	.pr-link {
		margin-bottom: 1rem;
	}

	.pr-link a {
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
	}

	.pr-link a:hover {
		text-decoration: underline;
	}

	.warning {
		background-color: #fffbeb;
		border: 1px solid #fcd34d;
		color: #92400e;
		padding: 1rem;
		border-radius: 0.5rem;
		margin-bottom: 2rem;
	}

	.warning p {
		margin: 0.25rem 0;
	}

	.artifact-card {
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		background: white;
	}

	.artifact-card summary {
		padding: 1rem;
		cursor: pointer;
		font-weight: 500;
		user-select: none;
	}

	.artifact-card summary:hover {
		background-color: #f9fafb;
	}

	.markdown-content {
		padding: 1rem;
		border-top: 1px solid #e5e7eb;
		overflow-x: auto;
	}

	.markdown-content :global(pre) {
		background-color: #f3f4f6;
		padding: 1rem;
		border-radius: 0.375rem;
		overflow-x: auto;
	}

	.markdown-content :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
		font-size: 0.875em;
	}

	.markdown-content :global(img) {
		max-width: 100%;
	}

	.actions {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: 2px solid #e5e7eb;
	}

	.comment-area {
		margin-bottom: 1.5rem;
	}

	.comment-area label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #374151;
	}

	.comment-area textarea {
		width: 100%;
		min-height: 120px;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-family: inherit;
		font-size: 1rem;
	}

	.button-group {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		font-size: 1rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.approve {
		background-color: #059669;
		color: white;
	}

	.approve:hover:not(:disabled) {
		background-color: #047857;
	}

	.in-progress {
		background-color: #2563eb;
		color: white;
	}

	.in-progress:hover:not(:disabled) {
		background-color: #1d4ed8;
	}

	.todo {
		background-color: #6b7280;
		color: white;
	}

	.todo:hover:not(:disabled) {
		background-color: #4b5563;
	}

	.error {
		color: #991b1b;
		padding: 1rem;
		background: #fee2e2;
		border-radius: 0.5rem;
	}

	.info {
		color: #6b7280;
		font-style: italic;
	}
</style>
