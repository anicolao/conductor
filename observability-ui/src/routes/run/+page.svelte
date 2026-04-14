<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { parseLogs } from '$lib/parser';
	import EventTimeline from '$lib/components/EventTimeline.svelte';
	import type { ConductorEvent, WorkflowRun } from '$lib/types';

	const id = page.url.searchParams.get('id');
	
	let run = $state<WorkflowRun | null>(null);
	let events = $state<ConductorEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		if (!id) {
			error = 'No run ID provided in the URL.';
			loading = false;
			return;
		}

		const token = sessionStorage.getItem('github_access_token');
		if (!token) {
			error = 'Not logged in. Please go to the home page to login.';
			loading = false;
			return;
		}

		try {
			// Fetch run details
			const runRes = await fetch(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${id}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!runRes.ok) throw new Error(`Failed to fetch run details: ${runRes.statusText}`);
			run = await runRes.json();

			// Fetch jobs
			const jobsRes = await fetch(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${id}/jobs`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!jobsRes.ok) throw new Error(`Failed to fetch jobs: ${jobsRes.statusText}`);
			const jobsData = await jobsRes.json();
			
			const conductorJob = jobsData.jobs.find((j: any) => j.name === 'run-conductor');
			if (!conductorJob) {
				error = 'Conductor job (run-conductor) not found in this run. It might still be starting or failed early.';
				loading = false;
				return;
			}

			// Fetch logs
			const logsRes = await fetch(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/jobs/${conductorJob.id}/logs`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			
			if (logsRes.status === 404) {
				error = 'Logs are not yet available for this job. They are usually available after the job completes.';
				loading = false;
				return;
			}

			if (!logsRes.ok) throw new Error(`Failed to fetch logs: ${logsRes.statusText}`);
			const rawLogs = await logsRes.text();
			
			events = parseLogs(rawLogs);
			
			if (events.length === 0) {
				// We don't necessarily want an error if there are no events yet, 
				// but it's good to know if the parsing failed or there just aren't any.
				console.log('No conductor events found in logs.');
			}
		} catch (e: any) {
			console.error(e);
			error = e.message;
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Run Details - {id || 'Unknown'}</title>
</svelte:head>

<div class="container">
	<nav>
		<a href="{base}/">← Back to Dashboard</a>
	</nav>

	{#if loading}
		<p class="status">Loading run details and logs...</p>
	{:else if error}
		<p class="error">{error}</p>
		{#if run}
			<div class="metadata" style="margin-top: 1rem;">
				<a href={run.html_url} target="_blank" rel="noopener noreferrer" class="drill-down">
					View on GitHub (Drill Down) ↗
				</a>
			</div>
		{/if}
	{:else}
		<header>
			<h1>Run Details: {run?.display_title || id}</h1>
			<div class="metadata">
				<span class="status-badge {run?.conclusion || run?.status}">
					{run?.conclusion || run?.status}
				</span>
				<a href={run?.html_url} target="_blank" rel="noopener noreferrer" class="drill-down">
					View on GitHub (Drill Down) ↗
				</a>
			</div>
		</header>

		<section class="timeline-section">
			<h2>Event Timeline</h2>
			{#if events.length > 0}
				<EventTimeline {events} />
			{:else}
				<p class="status">No conductor events found in the logs yet.</p>
			{/if}
		</section>
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

	header {
		margin-bottom: 2rem;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 1rem;
	}

	h1 {
		margin: 0 0 1rem 0;
		font-size: 1.875rem;
	}

	.metadata {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.status-badge.success { background: #dcfce7; color: #166534; }
	.status-badge.failure { background: #fee2e2; color: #991b1b; }
	.status-badge.in_progress { background: #fef9c3; color: #854d0e; }

	.drill-down {
		color: #4b5563;
		text-decoration: none;
		font-size: 0.875rem;
	}

	.drill-down:hover {
		text-decoration: underline;
	}

	.status {
		color: #6b7280;
		font-style: italic;
	}

	.error {
		color: #991b1b;
		padding: 1rem;
		background: #fee2e2;
		border-radius: 0.5rem;
	}

	.timeline-section {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 1rem;
	}

	h2 {
		margin-top: 0;
		font-size: 1.25rem;
		color: #374151;
	}
</style>
