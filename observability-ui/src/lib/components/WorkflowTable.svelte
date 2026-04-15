<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import type { WorkflowRun, Issue } from '$lib/types';

	interface Props {
		runs: WorkflowRun[];
	}

	let { runs }: Props = $props();
	let issueDetails = $state<Record<string, Issue>>({});
	let prDetails = $state<Record<string, { html_url: string; number: number }>>({});

	onMount(async () => {
		const token = sessionStorage.getItem('github_access_token');
		if (!token) return;

		// Extract unique issues to fetch
		const issuesToFetch = new Set<string>();
		runs.forEach((run) => {
			const parsed = parseTitle(run.display_title);
			if (parsed) {
				issuesToFetch.add(`${parsed.repo}/issues/${parsed.issue}`);
			}
		});

		// Fetch each issue
		await Promise.all(
			Array.from(issuesToFetch).map(async (path) => {
				try {
					const res = await fetch(`https://api.github.com/repos/${path}`, {
						headers: { Authorization: `Bearer ${token}` }
					});
					if (res.ok) {
						const issue: Issue = await res.json();
						issueDetails[path] = issue;
					}
				} catch (e) {
					console.error(`Failed to fetch issue ${path}`, e);
				}
			})
		);

		// For runs without a PR in issueDetails, try to find by branch label or head_branch
		await Promise.all(
			runs.map(async (run) => {
				const parsed = parseTitle(run.display_title);
				if (!parsed) return;

				const path = `${parsed.repo}/issues/${parsed.issue}`;
				if (issueDetails[path]?.pull_request) return;

				// Try to find PR by branch
				try {
					const [owner, repo] = parsed.repo.split('/');
					const issue = issueDetails[path];
					const branchLabel = issue?.labels?.find((l) => l.name.startsWith('branch:'));
					const branchName = branchLabel ? branchLabel.name.replace('branch:', '').trim() : run.head_branch;

					const res = await fetch(
						`https://api.github.com/repos/${parsed.repo}/pulls?head=${owner}:${branchName}`,
						{
							headers: { Authorization: `Bearer ${token}` }
						}
					);
					if (res.ok) {
						const pulls = await res.json();
						if (pulls.length > 0) {
							prDetails[run.id.toString()] = {
								html_url: pulls[0].html_url,
								number: pulls[0].number
							};
						}
					}
				} catch (e) {
					console.error(`Failed to fetch PR for run ${run.id}`, e);
				}
			})
		);
	});

	function parseTitle(title: string) {
		const regex = /Conductor \[(?<repo>[^\]]+)\] Issue #(?<issue>\d+)/;
		const match = title.match(regex);
		if (match?.groups) {
			return {
				repo: match.groups.repo,
				issue: match.groups.issue
			};
		}
		return null;
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleString();
	}
</script>

<div class="table-container">
	<table>
		<thead>
			<tr>
				<th>Repository</th>
				<th>Issue</th>
				<th>PR</th>
				<th>Workflow Run</th>
				<th>Timestamp</th>
			</tr>
		</thead>
		<tbody>
			{#each runs as run}
				{@const parsed = parseTitle(run.display_title)}
				<tr>
					<td>
						{#if parsed}
							<a href="https://github.com/{parsed.repo}" target="_blank" rel="noopener noreferrer">
								{parsed.repo}
							</a>
						{:else}
							<span class="fallback">{run.display_title}</span>
						{/if}
					</td>
					<td>
						{#if parsed}
							{@const path = `${parsed.repo}/issues/${parsed.issue}`}
							<a href="https://github.com/{path}" target="_blank" rel="noopener noreferrer">
								#{parsed.issue}{issueDetails[path] ? `: ${issueDetails[path].title}` : ''}
							</a>
						{:else}
							-
						{/if}
					</td>
					<td>
						{#if parsed}
							{@const path = `${parsed.repo}/issues/${parsed.issue}`}
							{#if issueDetails[path]?.pull_request}
								<a
									href={issueDetails[path].pull_request?.html_url}
									target="_blank"
									rel="noopener noreferrer"
								>
									PR #{issueDetails[path].number}
								</a>
							{:else if prDetails[run.id.toString()]}
								<a
									href={prDetails[run.id.toString()].html_url}
									target="_blank"
									rel="noopener noreferrer"
								>
									PR #{prDetails[run.id.toString()].number}
								</a>
							{:else}
								-
							{/if}
						{:else}
							-
						{/if}
					</td>
					<td>
						<a href="{base}/run?id={run.id}"> View Run </a>
					</td>
					<td>{formatDate(run.created_at)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-container {
		width: 100%;
		overflow-x: auto;
		margin-top: 2rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.875rem;
	}

	th {
		background-color: #f9fafb;
		padding: 0.75rem 1rem;
		font-weight: 600;
		color: #374151;
		border-bottom: 1px solid #e5e7eb;
	}

	td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e5e7eb;
		color: #4b5563;
	}

	tr:last-child td {
		border-bottom: none;
	}

	tr:hover {
		background-color: #f3f4f6;
	}

	a {
		color: #2563eb;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}

	.fallback {
		font-style: italic;
		color: #9ca3af;
	}
</style>
