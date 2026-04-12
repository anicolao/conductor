<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { PUBLIC_OAUTH_EXCHANGE_URL } from '$env/static/public';

	onMount(async () => {
		const code = $page.url.searchParams.get('code');
		if (code) {
			try {
				const response = await fetch(PUBLIC_OAUTH_EXCHANGE_URL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ code })
				});

				const data = await response.json();
				if (data.access_token) {
					sessionStorage.setItem('github_access_token', data.access_token);
				} else {
					console.error('OAuth exchange failed: no access token', data);
				}
			} catch (e) {
				console.error('OAuth exchange failed', e);
			}
		}
		goto('/');
	});
</script>

<p>Authenticating...</p>
