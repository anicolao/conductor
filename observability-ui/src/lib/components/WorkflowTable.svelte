<script lang="ts">
	import type { WorkflowRun } from '$lib/types';

	interface Props {
		runs: WorkflowRun[];
	}

	let { runs }: Props = $props();

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
							<a href="https://github.com/{parsed.repo}/issues/{parsed.issue}" target="_blank" rel="noopener noreferrer">
								#{parsed.issue}
							</a>
						{:else}
							-
						{/if}
					</td>
					<td>
						<a href={run.html_url} target="_blank" rel="noopener noreferrer">
							View Run
						</a>
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
