<script lang="ts">
	import { onMount } from "svelte";
	import { base } from "$app/paths";
	import { getAccessToken, login } from "$lib/auth";

	let items = $state<any[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const PROJECT_ID = "PVT_kwDOEGPutc4BUN0D";
	const HUMAN_REVIEW_OPTION_ID = "0fd775be";

	onMount(async () => {
		const token = getAccessToken();
		if (!token) {
			login();
			return;
		}

		try {
			const res = await fetch("https://api.github.com/graphql", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: `
						query {
							node(id: "${PROJECT_ID}") {
								... on ProjectV2 {
									items(first: 100) {
										nodes {
											id
											fieldValues(first: 20) {
												nodes {
													... on ProjectV2ItemFieldSingleSelectValue {
														field {
															... on ProjectV2SingleSelectField {
																name
															}
														}
														name
														optionId
													}
												}
											}
											content {
												... on Issue {
													number
													title
													repository {
														name
														owner {
															login
														}
													}
												}
											}
										}
									}
								}
							}
						}
					`,
				}),
			});

			if (!res.ok) {
				throw new Error("Failed to fetch project items");
			}

			const json = await res.json();
			if (json.errors) {
				throw new Error(json.errors[0].message);
			}

			const allItems = json.data.node.items.nodes;
			items = allItems.filter((item: any) => {
				const statusField = item.fieldValues.nodes.find(
					(f: any) => f.field?.name === "Status"
				);
				return statusField && statusField.optionId === HUMAN_REVIEW_OPTION_ID;
			}).filter((item: any) => item.content?.number); // Ensure it's an Issue

		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Approval Queue</title>
</svelte:head>

<div class="container">
	<nav>
		<a href="{base}/">← Back to Dashboard</a>
	</nav>

	<h1>Approval Queue</h1>

	{#if loading}
		<p>Loading...</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else if items.length === 0}
		<p>No items pending human review.</p>
	{:else}
		<table class="approval-table">
			<thead>
				<tr>
					<th>Repository</th>
					<th>Issue</th>
					<th>Title</th>
					<th>Action</th>
				</tr>
			</thead>
			<tbody>
				{#each items as item}
					{@const repo = item.content.repository}
					{@const issue = item.content}
					<tr>
						<td>{repo.owner.login}/{repo.name}</td>
						<td>#{issue.number}</td>
						<td>{issue.title}</td>
						<td>
							<a href="{base}/approval/{repo.owner.login}/{repo.name}/{issue.number}">Review</a>
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
		margin: 0 0 2rem 0;
	}

	.error {
		color: #991b1b;
		padding: 1rem;
		background: #fee2e2;
		border-radius: 0.5rem;
	}

	.approval-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
	}

	.approval-table th,
	.approval-table td {
		padding: 0.75rem;
		border: 1px solid #e5e7eb;
		text-align: left;
	}

	.approval-table th {
		background: #f9fafb;
		font-weight: 600;
	}

	.approval-table a {
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
	}

	.approval-table a:hover {
		text-decoration: underline;
	}
</style>
