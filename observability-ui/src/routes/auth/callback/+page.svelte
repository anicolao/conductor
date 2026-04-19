<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { PUBLIC_OAUTH_EXCHANGE_URL } from '$env/static/public';
	import { setAccessToken, getRedirectPath, clearRedirectPath } from '$lib/auth';

	let exchanged = false;

	onMount(async () => {
		const code = $page.url.searchParams.get('code');
		if (code && !exchanged) {
			exchanged = true;
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
					setAccessToken(data.access_token);
				} else {
					console.error('OAuth exchange failed: no access token', data);
				}
			} catch (e) {
				console.error('OAuth exchange failed', e);
			}
		}
		
		const redirectPath = getRedirectPath();
		clearRedirectPath();
		goto(redirectPath);
	});
</script>

<p>Authenticating...</p>
