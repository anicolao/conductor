<script lang="ts">
import { onMount } from "svelte";
import { base } from "$app/paths";
import { getAccessToken, login } from "$lib/auth";

interface GitHubRepo {
	nameWithOwner: string;
	owner: { login: string };
	name: string;
}

interface GitHubIssue {
	number: number;
	title: string;
	repository: GitHubRepo;
}

interface ProjectItem {
	id: string;
	status?: {
		name: string;
		optionId: string;
	};
	content: GitHubIssue;
}

let items = $state<ProjectItem[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);

const ORG = "LLM-Orchestration";
const PROJECT_NUMBER = 1;
const HUMAN_REVIEW_OPTION_ID = "0fd775be";

onMount(async () => {
	const token = getAccessToken();
	if (!token) {
		login();
		return;
	}

	try {
		const query = `
			query ProjectItems($org: String!, $number: Int!) {
				organization(login: $org) {
					projectV2(number: $number) {
						items(first: 100) {
							nodes {
								id
								status: fieldValueByName(name: "Status") {
									... on ProjectV2ItemFieldSingleSelectValue {
										name
										optionId
									}
								}
								content {
									... on Issue {
										number
										title
										repository {
											nameWithOwner
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
		`;

		const response = await fetch("https://api.github.com/graphql", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				variables: { org: ORG, number: PROJECT_NUMBER },
			}),
		});

		const result = await response.json();
		if (result.errors) {
			throw new Error(result.errors[0].message);
		}

		const allItems = result.data.organization.projectV2.items.nodes;
		items = allItems.filter(
			(item: ProjectItem) =>
				item.status?.optionId === HUMAN_REVIEW_OPTION_ID &&
				item.content?.number,
		);
	} catch (e: unknown) {
		console.error(e);
		error = e instanceof Error ? e.message : String(e);
	} finally {
		loading = false;
	}
});
</script>

<svelte:head>
	<title>Approval Queue - Conductor</title>
</svelte:head>

<div class="container">
	<nav>
		<a href="{base}/">← Back to Dashboard</a>
	</nav>

	<h1>Approval Queue</h1>

	{#if loading}
		<p>Loading approval queue...</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else if items.length === 0}
		<p>No items currently in Human Review.</p>
	{:else}
		<div class="desktop-view">
			<table>
				<thead>
					<tr>
						<th>Issue</th>
						<th>Repository</th>
						<th>Title</th>
						<th>Action</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item}
						<tr>
							<td>#{item.content.number}</td>
							<td>{item.content.repository.nameWithOwner}</td>
							<td>{item.content.title}</td>
							<td>
								<a href="{base}/approval/{item.content.repository.owner.login}/{item.content.repository.name}/{item.content.number}" class="view-link">
									View & Approve
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="mobile-view">
			{#each items as item}
				<a href="{base}/approval/{item.content.repository.owner.login}/{item.content.repository.name}/{item.content.number}" class="mobile-card-link">
					<div class="approval-card">
						<div class="card-header">
							<span class="repo-tag">{item.content.repository.nameWithOwner}</span>
							<span class="issue-tag">#{item.content.number}</span>
						</div>
						<h2 class="card-title">{item.content.title}</h2>
						<div class="card-footer">
							<span class="action-hint">View & Approve →</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
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

		.desktop-view {
			display: none;
		}

		.mobile-view {
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}
	}

	@media (min-width: 769px) {
		.mobile-view {
			display: none;
		}
	}

	nav {
		margin-bottom: 2rem;
	}

	nav a {
		color: #2563eb;
		text-decoration: none;
	}

	h1 {
		margin-bottom: 2rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
	}

	th, td {
		text-align: left;
		padding: 0.75rem;
		border-bottom: 1px solid #e5e7eb;
	}

	th {
		background-color: #f9fafb;
		font-weight: 600;
	}

	.view-link {
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
	}

	.view-link:hover {
		text-decoration: underline;
	}

	/* Mobile Card Styles */
	.mobile-card-link {
		text-decoration: none;
		color: inherit;
		display: block;
	}

	.approval-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		padding: 1.25rem;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.mobile-card-link:active .approval-card {
		background-color: #f9fafb;
		border-color: #d1d5db;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.issue-tag {
		font-weight: 500;
		color: #9ca3af;
		font-size: 0.75rem;
	}

	.repo-tag {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.card-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #111827;
		margin: 0 0 0.75rem 0;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-footer {
		display: flex;
		justify-content: flex-end;
	}

	.action-hint {
		font-size: 0.875rem;
		font-weight: 600;
		color: #2563eb;
	}

	.error {
		color: #991b1b;
		padding: 1rem;
		background: #fee2e2;
		border-radius: 0.5rem;
	}
</style>
