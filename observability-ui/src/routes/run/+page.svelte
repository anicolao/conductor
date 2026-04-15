<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import { parseLogs } from '$lib/parser';
	import EventTimeline from '$lib/components/EventTimeline.svelte';
	import type { ConductorEvent, WorkflowRun, WorkflowJob } from '$lib/types';

	const id = $derived(browser ? page.url.searchParams.get('id') : null);
	
	let run = $state<WorkflowRun | null>(null);
	let events = $state<ConductorEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let polling = $state(false);
	let logsAvailable = $state(false);
	let pollingInterval: any = null;

	async function fetchData(currentId: string, isInitial = false) {
		if (isInitial) loading = true;
		error = null;
		
		const token = sessionStorage.getItem('github_access_token');
		if (!token) {
			error = 'Not logged in. Please go to the home page to login.';
			loading = false;
			stopPolling();
			return;
		}

		try {
			// Fetch run details
			const runRes = await fetch(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${currentId}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!runRes.ok) throw new Error(`Failed to fetch run details: ${runRes.statusText}`);
			run = await runRes.json();

			// Fetch jobs
			const jobsRes = await fetch(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${currentId}/jobs`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!jobsRes.ok) throw new Error(`Failed to fetch jobs: ${jobsRes.statusText}`);
			const jobsData = await jobsRes.json();
			
			const conductorJob: WorkflowJob = jobsData.jobs.find((j: any) => j.name === 'run-conductor');
			
			if (!conductorJob) {
				if (run?.status === 'completed') {
					error = 'Conductor job (run-conductor) not found in this run. It might have failed early.';
					stopPolling();
				}
				loading = false;
				return;
			}

			// Fetch logs
			const logsRes = await fetch(`https://api.github.com/repos/LLM-Orchestration/conductor/actions/jobs/${conductorJob.id}/logs`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			
			if (logsRes.status === 404) {
				// While logs are not available, map steps to temporary events
				events = (conductorJob.steps || [])
					.filter(s => s.status !== 'queued')
					.map(step => ({
						v: 1,
						ts: step.started_at || new Date().toISOString(),
						event: 'TASK',
						data: {
							text: `${step.name}: ${step.status}${step.conclusion ? ' (' + step.conclusion + ')' : ''}`
						}
					}));
				logsAvailable = false;
			} else if (logsRes.ok) {
				const rawLogs = await logsRes.text();
				const parsedEvents = parseLogs(rawLogs);
				if (parsedEvents.length > 0) {
					events = parsedEvents;
					logsAvailable = true;
				} else {
					// Fallback to steps if logs exist but have no conductor events yet
					events = (conductorJob.steps || [])
						.filter(s => s.status !== 'queued')
						.map(step => ({
							v: 1,
							ts: step.started_at || new Date().toISOString(),
							event: 'TASK',
							data: {
								text: `${step.name}: ${step.status}${step.conclusion ? ' (' + step.conclusion + ')' : ''}`
							}
						}));
					logsAvailable = false;
				}
			} else {
				throw new Error(`Failed to fetch logs: ${logsRes.statusText}`);
			}

			// Stop polling if completed and logs fetched
			if (run?.status === 'completed' && logsAvailable) {
				stopPolling();
			}
		} catch (e: any) {
			console.error(e);
			error = e.message;
			stopPolling();
		} finally {
			loading = false;
		}
	}

	function startPolling(currentId: string) {
		if (polling || !browser) return;
		polling = true;
		pollingInterval = setInterval(() => fetchData(currentId), 5000);
	}

	function stopPolling() {
		polling = false;
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
	}

	onMount(async () => {
		let currentId = id || page.url.searchParams.get('id');
		
		if (!currentId) {
			for (let i = 0; i < 20; i++) {
				await new Promise(resolve => setTimeout(resolve, 50));
				currentId = id || page.url.searchParams.get('id');
				if (currentId) break;
			}
		}

		if (currentId) {
			await fetchData(currentId, true);
			if (run?.status !== 'completed' || !logsAvailable) {
				startPolling(currentId);
			}
		} else {
			error = 'No run ID provided in the URL.';
			loading = false;
		}
	});

	onDestroy(() => {
		stopPolling();
	});
</script>

<svelte:head>
	<title>Run Details - {id || 'Unknown'}</title>
</svelte:head>

<div class="container">
	<nav>
		<a href="{base}/">← Back to Dashboard</a>
	</nav>

	{#if loading && !run}
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
				{#if polling}
					<span class="streaming-indicator">
						<span class="dot"></span> Live
					</span>
				{/if}
				<a href={run?.html_url} target="_blank" rel="noopener noreferrer" class="drill-down">
					View on GitHub (Drill Down) ↗
				</a>
			</div>
		</header>

		<section class="timeline-section">
			<h2>Event Timeline</h2>
			{#if events.length > 0}
				<EventTimeline {events} />
				{#if !logsAvailable && run?.status !== 'completed'}
					<p class="status small">Waiting for logs to stream... Showing job steps for now.</p>
				{/if}
			{:else}
				<p class="status">
					{#if polling}
						Waiting for logs to stream...
					{:else}
						No conductor events found in the logs yet.
					{/if}
				</p>
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

	.streaming-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #16a34a;
		font-weight: 600;
	}

	.dot {
		width: 8px;
		height: 8px;
		background-color: #16a34a;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
		}
		70% {
			transform: scale(1);
			box-shadow: 0 0 0 10px rgba(22, 163, 74, 0);
		}
		100% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
		}
	}

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

	.status.small {
		font-size: 0.875rem;
		margin-top: 1rem;
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
