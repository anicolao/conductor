<script lang="ts">
import { onMount } from "svelte";
import { PUBLIC_GITHUB_CLIENT_ID } from "$env/static/public";
import {
	logout as authLogout,
	clearAccessToken,
	getAccessToken,
	login,
} from "$lib/auth";
import WorkflowTable from "$lib/components/WorkflowTable.svelte";
import type { WorkflowRun, WorkflowRunsResponse } from "$lib/types";

let user = $state<{ login: string; avatar_url: string } | null>(null);
let repo = $state<{ name: string; full_name: string } | null>(null);
let workflowRuns = $state<WorkflowRun[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);

onMount(async () => {
	const token = getAccessToken();
	if (token) {
		try {
			const [userRes, repoRes, runsRes] = await Promise.all([
				fetch("https://api.github.com/user", {
					headers: { Authorization: `Bearer ${token}` },
				}),
				fetch("https://api.github.com/repos/LLM-Orchestration/conductor", {
					headers: { Authorization: `Bearer ${token}` },
				}),
				fetch(
					"https://api.github.com/repos/LLM-Orchestration/conductor/actions/workflows/conductor.yml/runs?per_page=50",
					{
						headers: { Authorization: `Bearer ${token}` },
					},
				),
			]);

			if (userRes.ok) {
				user = await userRes.json();
			} else {
				clearAccessToken();
				error = "GitHub session expired. Please login again.";
			}

			if (repoRes.ok) {
				repo = await repoRes.json();
			} else if (userRes.ok) {
				error = "Failed to verify repository access.";
			}

			if (runsRes.ok) {
				const data: WorkflowRunsResponse = await runsRes.json();
				workflowRuns = data.workflow_runs;
			} else if (userRes.ok) {
				error = "Failed to fetch recent workflows.";
			}
		} catch (e) {
			console.error("Failed to fetch from GitHub", e);
			error = "Failed to fetch from GitHub";
		}
	}
	loading = false;
});

function handleLogin() {
	login();
}

function handleLogout() {
	authLogout();
	user = null;
	repo = null;
	workflowRuns = [];
}
</script>

<svelte:head>
	<title>Conductor Observability</title>
</svelte:head>

<h1>Conductor Observability</h1>

{#if loading}
	<p>Loading...</p>
{:else if user}
	<div class="profile">
		<img src={user.avatar_url} alt={user.login} />
		<p>Logged in as <strong>{user.login}</strong></p>
		<button onclick={handleLogout}>Logout</button>
	</div>

	{#if repo}
		<div class="repo-verification">
			<p>Accessing repository: <strong>{repo.full_name}</strong></p>
			<p class="success">GitHub API Verified ✅</p>
		</div>
	{/if}

	<h2>Recent Workflows</h2>
	{#if workflowRuns.length > 0}
		<WorkflowTable runs={workflowRuns} />
	{:else}
		<p>No recent workflows found.</p>
	{/if}
{:else}
	<button onclick={handleLogin}>Login with GitHub</button>
{/if}

{#if error}
	<p class="error">{error}</p>
{/if}

<style>
	.profile {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1rem 0;
	}

	.profile img {
		width: 50px;
		height: 50px;
		border-radius: 50%;
	}

	.repo-verification {
		margin-top: 1rem;
		padding: 1rem;
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 0.5rem;
	}

	.success {
		color: #166534;
		font-weight: bold;
	}

	.error {
		color: #991b1b;
	}
</style>
