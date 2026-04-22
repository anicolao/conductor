<script lang="ts">
import { base } from "$app/paths";
import { getAccessToken } from "$lib/auth";
import type { Issue, WorkflowRun } from "$lib/types";

interface Props {
	runs: WorkflowRun[];
}

let { runs }: Props = $props();
let issueDetails = $state<Record<string, Issue>>({});
let prDetails = $state<Record<string, { html_url: string; number: number }>>(
	{},
);

// Track in-flight requests to avoid redundant calls
const inFlight = new Set<string>();

$effect(() => {
	const token = getAccessToken();
	if (!token || !runs.length) return;

	runs.forEach(async (run) => {
		const parsed = parseTitle(run.display_title);
		if (!parsed) return;

		const issuePath = `${parsed.repo}/issues/${parsed.issue}`;
		const runId = run.id.toString();

		// 1. Fetch issue details if missing
		if (!issueDetails[issuePath] && !inFlight.has(issuePath)) {
			inFlight.add(issuePath);
			try {
				const res = await fetch(`https://api.github.com/repos/${issuePath}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (res.ok) {
					issueDetails[issuePath] = await res.json();
				}
			} catch (e) {
				console.error(`Failed to fetch issue ${issuePath}`, e);
			} finally {
				inFlight.delete(issuePath);
			}
		}

		// 2. Determine PR details
		if (prDetails[runId] || inFlight.has(`pr-${runId}`)) return;

		// A. Check if run has PR info
		if (run.pull_requests && run.pull_requests.length > 0) {
			prDetails[runId] = {
				html_url: run.pull_requests[0].html_url,
				number: run.pull_requests[0].number,
			};
			return;
		}

		// B. Check if issue is a PR (wait for issue details)
		const issue = issueDetails[issuePath];
		if (issue) {
			if (issue.pull_request) {
				prDetails[runId] = {
					html_url: issue.pull_request.html_url,
					number: issue.number,
				};
				return;
			}

			// C. Try fallback lookups (only if we have issue details but it's not a PR)
			inFlight.add(`pr-${runId}`);
			try {
				const [owner] = parsed.repo.split("/");
				const branchLabel = issue.labels?.find((l) =>
					l.name.startsWith("branch:"),
				);
				const branchName = branchLabel
					? branchLabel.name.replace("branch:", "").trim()
					: run.head_branch;

				// Try lookup by branch
				if (branchName && branchName !== "main" && branchName !== "master") {
					const res = await fetch(
						`https://api.github.com/repos/${parsed.repo}/pulls?head=${owner}:${branchName}&state=all`,
						{ headers: { Authorization: `Bearer ${token}` } },
					);
					if (res.ok) {
						const pulls = await res.json();
						if (pulls.length > 0) {
							prDetails[runId] = {
								html_url: pulls[0].html_url,
								number: pulls[0].number,
							};
							return;
						}
					}
				}

				// Fallback: Search for PRs referencing the issue number
				const searchRes = await fetch(
					`https://api.github.com/search/issues?q=repo:${parsed.repo}+type:pr+${parsed.issue}`,
					{ headers: { Authorization: `Bearer ${token}` } },
				);
				if (searchRes.ok) {
					const searchData = await searchRes.json();
					if (searchData.items && searchData.items.length > 0) {
						prDetails[runId] = {
							html_url: searchData.items[0].html_url,
							number: searchData.items[0].number,
						};
					}
				}
			} catch (e) {
				console.error(`Failed to fetch PR for run ${run.id}`, e);
			} finally {
				inFlight.delete(`pr-${runId}`);
			}
		}
	});
});

function parseTitle(title: string) {
	const regex = /Conductor \[(?<repo>[^\]]+)\] Issue #(?<issue>\d+)/;
	const match = title.match(regex);
	if (match?.groups) {
		return {
			repo: match.groups.repo,
			issue: match.groups.issue,
		};
	}
	return null;
}

function formatDate(dateString: string) {
	return new Date(dateString).toLocaleString();
}

function formatStatus(status: string) {
	if (status === "completed") return "complete";
	if (status === "in_progress") return "in progress";
	if (status === "queued") return "queued";
	return status.replace(/_/g, " ");
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
						<a href="{base}/run?id={run.id}"> {formatStatus(run.status)} </a>
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
