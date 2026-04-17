<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const version = __APP_VERSION__;
	const commit = __COMMIT_HASH__;
	const buildDate = new Date(__BUILD_DATE__).toLocaleDateString();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<footer class="version-info">
	v{version} ({commit}) {buildDate}
</footer>

<style>
	.version-info {
		position: fixed;
		bottom: 0.5rem;
		right: 0.5rem;
		font-size: 0.7rem;
		color: #666;
		pointer-events: none;
		z-index: 1000;
	}
</style>
