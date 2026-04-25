<script lang="ts">
import { onMount } from "svelte";
import { base } from "$app/paths";
import { getAccessToken, login } from "$lib/auth";

let items = $state<any[]>([]);
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
		items = allItems.filter((item: any) => 
			item.status?.optionId === HUMAN_REVIEW_OPTION_ID && item.content?.number
		);
	} catch (e: any) {
		console.error(e);
		error = e.message;
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
	{/if}
</div>

<style>
	.container {
		max-width: 1000px;
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

	.error {
		color: #991b1b;
		padding: 1rem;
		background: #fee2e2;
		border-radius: 0.5rem;
	}
</style>
