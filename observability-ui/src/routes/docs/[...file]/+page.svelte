<script lang="ts">
import { marked } from "marked";
import { enhanceImages } from "$lib";
import { page } from "$app/state";
import { base } from "$app/paths";

let content = $state("");
let loading = $state(true);
let error = $state<string | null>(null);

const file = $derived(page.params.file.replace(/\/$/, ""));

async function fetchMarkdown(path: string) {
	loading = true;
	error = null;
	try {
		// Use the GitHub Raw URL. 
		// We use 'main' as default, but we could eventually make this configurable.
		const branch = "main";
		const baseUrl = `https://raw.githubusercontent.com/LLM-Orchestration/conductor/${branch}/`;
		const response = await fetch(`${baseUrl}${path}`);
		
		if (!response.ok) {
			throw new Error(`Failed to fetch documentation: ${response.status} ${response.statusText}`);
		}
		
		const text = await response.text();
		
		// Fix relative image paths to be absolute from the markdown file's location
		// Example: ![Alt](./screenshots/001.png) -> ![Alt](https://raw.../path/to/docs/screenshots/001.png)
		const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
		const fixedText = text.replace(/!\[(.*?)\]\(\.\/(.*?)\)/g, (match, alt, imgPath) => {
			const fullImgPath = dir ? `${dir}/${imgPath}` : imgPath;
			return `![${alt}](${baseUrl}${fullImgPath})`;
		});

		content = await marked.parse(fixedText);
	} catch (e) {
		console.error(e);
		error = e instanceof Error ? e.message : String(e);
	} finally {
		loading = false;
	}
}

$effect(() => {
	if (file) {
		fetchMarkdown(file);
	}
});
</script>

<svelte:head>
	<title>Docs: {file}</title>
</svelte:head>

<div class="container">
	<nav>
		<a href="{base}/">← Back to Dashboard</a>
	</nav>

	{#if loading}
		<p class="status">Loading documentation...</p>
	{:else if error}
		<div class="error">
			<p><strong>Error:</strong> {error}</p>
			<p>Make sure the file exists in the repository: <code>{file}</code></p>
		</div>
	{:else}
		<article class="markdown-body" use:enhanceImages>
			{@html content}
		</article>
	{/if}
</div>

<style>
	.container {
		max-width: 900px;
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

	.markdown-body {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		padding: 2rem;
		line-height: 1.6;
	}

	.markdown-body :global(h1) { font-size: 2rem; margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
	.markdown-body :global(h2) { font-size: 1.5rem; margin-top: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.3rem; }
	.markdown-body :global(h3) { font-size: 1.25rem; margin-top: 1.2rem; }
	.markdown-body :global(p) { margin: 1rem 0; }
	.markdown-body :global(img) { max-width: 100%; height: auto; border-radius: 4px; border: 1px solid #eee; }
	.markdown-body :global(ul), .markdown-body :global(ol) { padding-left: 2rem; margin: 1rem 0; }
	.markdown-body :global(code) { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-family: monospace; }
	.markdown-body :global(pre) { background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
	.markdown-body :global(pre code) { background: none; padding: 0; }
	.markdown-body :global(hr) { border: 0; border-top: 1px solid #eee; margin: 2rem 0; }
</style>
