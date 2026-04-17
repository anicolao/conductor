import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

const rawCommitHash = process.env.VITE_COMMIT_HASH || commitHash;
const finalCommitHash = (typeof rawCommitHash === 'string' && /^[0-9a-f]{40}$/i.test(rawCommitHash))
	? rawCommitHash.slice(0, 7)
	: rawCommitHash;

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || pkg.version),
		__BUILD_DATE__: JSON.stringify(process.env.VITE_BUILD_DATE || new Date().toISOString().split('T')[0]),
		__COMMIT_HASH__: JSON.stringify(finalCommitHash)
	}
});
