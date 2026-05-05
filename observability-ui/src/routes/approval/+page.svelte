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
	updatedAt: string;
	bodyText: string;
	author: {
		login: string;
		avatarUrl: string;
	};
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
										updatedAt
										bodyText
										author {
											login
											avatarUrl
										}
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

function formatRelativeTime(dateString: string) {
	const date = new Date(dateString);
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 60) return "just now";
	if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
	if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
	if (diffInSeconds < 604800)
		return `${Math.floor(diffInSeconds / 86400)}d ago`;

	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
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
								<a href="{base}/approval/{item.content.repository.owner.login}/{item.content.repository.name}/{item.content.number}?itemId={item.id}" class="view-link">
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
				<a href="{base}/approval/{item.content.repository.owner.login}/{item.content.repository.name}/{item.content.number}?itemId={item.id}" class="mobile-item-link">
					<div class="list-item">
						<div class="avatar-col">
							<img src={item.content.author.avatarUrl} alt={item.content.author.login} class="author-avatar" />
						</div>
						<div class="content-col">
							<div class="item-header">
								<span class="repo-name">{item.content.repository.nameWithOwner}</span>
								<span class="time-stamp">{formatRelativeTime(item.content.updatedAt)}</span>
							</div>
							<div class="item-subject">
								{item.content.title}
							</div>
							<div class="item-snippet">
								{item.content.bodyText}
							</div>
							<div class="item-footer">
								<span class="issue-number">#{item.content.number}</span>
							</div>
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
			padding: 0;
		}

		nav {
			padding: 1rem 1rem 0 1rem;
		}

		h1 {
			padding: 0 1rem;
			margin-bottom: 1rem !important;
			font-size: 1.5rem;
		}

		.desktop-view {
			display: none;
		}

		.mobile-view {
			display: flex;
			flex-direction: column;
			border-top: 1px solid #e5e7eb;
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

	/* Mobile List Styles */
	.mobile-item-link {
		text-decoration: none;
		color: inherit;
		display: block;
		border-bottom: 1px solid #e5e7eb;
		background: #fff;
		transition: background-color 0.2s;
	}

	.mobile-item-link:active {
		background-color: #f3f4f6;
	}

	.list-item {
		display: flex;
		padding: 0.875rem 1rem;
		gap: 0.75rem;
	}

	.avatar-col {
		flex-shrink: 0;
	}

	.author-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background-color: #f3f4f6;
	}

	.content-col {
		flex-grow: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	.repo-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: #111827;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.time-stamp {
		font-size: 0.75rem;
		color: #6b7280;
		flex-shrink: 0;
	}

	.item-subject {
		font-size: 0.875rem;
		font-weight: 700;
		color: #111827;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-snippet {
		font-size: 0.875rem;
		color: #4b5563;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
	}

	.item-footer {
		margin-top: 0.25rem;
	}

	.issue-number {
		font-size: 0.75rem;
		color: #9ca3af;
		font-family: monospace;
	}

	.error {
		color: #991b1b;
		padding: 1rem;
		background: #fee2e2;
		border-radius: 0.5rem;
	}
</style>
