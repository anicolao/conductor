<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_GITHUB_CLIENT_ID } from '$env/static/public';

	let user = $state<{ login: string; avatar_url: string } | null>(null);
	let loading = $state(true);

	onMount(async () => {
		const token = sessionStorage.getItem('github_access_token');
		if (token) {
			try {
				const res = await fetch('https://api.github.com/user', {
					headers: {
						Authorization: `Bearer ${token}`
					}
				});
				if (res.ok) {
					user = await res.json();
				} else {
					sessionStorage.removeItem('github_access_token');
				}
			} catch (e) {
				console.error('Failed to fetch user', e);
			}
		}
		loading = false;
	});

	function login() {
		const clientId = PUBLIC_GITHUB_CLIENT_ID;
		const scope = 'repo,workflow';
		window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}`;
	}

	function logout() {
		sessionStorage.removeItem('github_access_token');
		user = null;
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
		<button onclick={logout}>Logout</button>
	</div>
{:else}
	<button onclick={login}>Login with GitHub</button>
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
</style>
