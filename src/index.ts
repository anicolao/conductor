import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import dotenv from 'dotenv';

import { CommandResult, runStreamingCommand } from './utils/exec';
import { GitHubEvent, extractEventData } from './utils/github';

function verifyGitHubCli(repository: string, issueNumber: number): string {
  const repoCheck = spawnSync('gh', ['repo', 'view', repository, '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], {
    encoding: 'utf8',
    env: process.env
  });

  if (repoCheck.status !== 0) {
    const authStatus = spawnSync('gh', ['auth', 'status'], {
      encoding: 'utf8',
      env: process.env
    });

    const failureDetails = (repoCheck.stderr || repoCheck.stdout || authStatus.stderr || authStatus.stdout || 'No gh output captured').trim();

    console.error(`GitHub CLI preflight failed for ${repository}.`);
    if (failureDetails) process.stderr.write(`${failureDetails}\n`);

    const body = `### ❌ GitHub CLI Preflight Failed

Issue #${issueNumber} could not verify \`gh\` access to \`${repository}\` before invoking Gemini.

<details>
<summary>Preflight output</summary>

\`\`\`
${failureDetails}
\`\`\`
</details>

*Automated report by Conductor*`;

    spawnSync('gh', ['issue', 'comment', String(issueNumber), '-R', repository, '--body', body], {
      stdio: 'inherit',
      env: process.env
    });

    process.exit(repoCheck.status || 1);
  }

  return repoCheck.stdout.trim();
}

function buildGeminiEnv(): NodeJS.ProcessEnv {
  const forwardedKeys = [
    'PATH',
    'HOME',
    'LANG',
    'SHELL',
    'TERM',
    'TMPDIR',
    'TMP',
    'TEMP',
    'USER',
    'LOGNAME',
    'COLORTERM',
    'CI',
    'GITHUB_ACTIONS',
    'GITHUB_ACTOR',
    'GITHUB_EVENT_NAME',
    'GITHUB_EVENT_PATH',
    'GITHUB_REPOSITORY',
    'GITHUB_RUN_ATTEMPT',
    'GITHUB_RUN_ID',
    'GITHUB_RUN_NUMBER',
    'RUNNER_ARCH',
    'RUNNER_OS',
    'RUNNER_TEMP',
    'RUNNER_TOOL_CACHE',
    'CONDUCTOR_TOKEN',
    'GH_TOKEN',
    'GITHUB_TOKEN'
  ];
  const env: NodeJS.ProcessEnv = {};

  for (const key of forwardedKeys) {
    const value = process.env[key];
    if (value) env[key] = value;
  }

  if (process.env.GEMINI_API_KEY) {
    env.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    return env;
  }

  if (process.env.GOOGLE_API_KEY) {
    env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  }

  return env;
}

function loadIssueState(repository: string, issueNumber: number): { labels: string[]; body: string; latestComment: string; htmlUrl: string; nodeId: string } | null {
  const issueData = spawnSync('gh', ['api', `repos/${repository}/issues/${issueNumber}`], {
    encoding: 'utf8',
    env: process.env
  });

  if (issueData.status !== 0 || !issueData.stdout.trim()) {
    return null;
  }

  const parsed = JSON.parse(issueData.stdout);

  // Fetch latest comment
  const commentsData = spawnSync('gh', ['api', `repos/${repository}/issues/${issueNumber}/comments`, '--jq', '.[-1].body // empty'], {
    encoding: 'utf8',
    env: process.env
  });

  return {
    labels: Array.isArray(parsed.labels) ? parsed.labels.map((label: { name: string }) => label.name) : [],
    body: parsed.body || '',
    latestComment: commentsData.status === 0 ? commentsData.stdout.trim() : '',
    htmlUrl: parsed.html_url || '',
    nodeId: parsed.node_id || ''
  };
}

function activatePersonaLabel(repository: string, issueNumber: number, persona: 'conductor' | 'coder'): void {
  const result = spawnSync('gh', ['issue', 'edit', String(issueNumber), '-R', repository, '--add-label', `persona: ${persona}`], {
    encoding: 'utf8',
    env: process.env
  });

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || 'No gh output captured').trim();
    console.error(`Failed to activate ${persona} persona on issue #${issueNumber} in ${repository}`);
    if (details) process.stderr.write(`${details}\n`);
  }
}

async function main() {
  dotenv.config();

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error('GITHUB_EVENT_PATH not set');
    process.exit(1);
  }

  const event: GitHubEvent = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const eventName = process.env.GITHUB_EVENT_NAME;
  
  let {
    repository,
    issueNumber,
    issueUrl,
    issueNodeId,
    labels,
    issueBody,
    commentBody,
    projectNumber,
    projectUrl
  } = extractEventData(event, process.env);

  if (!issueNumber) {
    console.error('No issue number found in event');
    process.exit(0);
  }

  if (!repository) {
    console.error('No repository found in event');
    process.exit(1);
  }

  const liveIssueState = loadIssueState(repository, issueNumber);
  if (liveIssueState) {
    labels = liveIssueState.labels;
    issueBody = liveIssueState.body;
    commentBody = liveIssueState.latestComment;
    issueUrl = liveIssueState.htmlUrl;
    issueNodeId = liveIssueState.nodeId;
  }

  if (eventName === 'repository_dispatch' && !labels.some(label => label.startsWith('persona:'))) {
    const targetPersona = (event.client_payload?.persona === 'coder' || event.client_payload?.persona === 'conductor') 
      ? event.client_payload.persona 
      : 'conductor';
    console.log(`repository_dispatch received for issue #${issueNumber} in ${repository}. Activating ${targetPersona} persona.`);
    activatePersonaLabel(repository, issueNumber, targetPersona);
    labels.push(`persona: ${targetPersona}`);
  }

  // 1. Determine Persona
  let persona: 'conductor' | 'coder' | null = null;
  
  const payloadPersona = event.client_payload?.persona;
  if (payloadPersona === 'coder' || payloadPersona === 'conductor') {
    persona = payloadPersona;
  } else if (labels.includes('persona: coder')) {
    persona = 'coder';
  } else if (labels.includes('persona: conductor')) {
    persona = 'conductor';
  } else {
    // Implicit initiation check
    const body = commentBody || issueBody || '';
    if (body.includes('@conductor')) {
      persona = 'conductor';
    }
  }

  if (!persona) {
    console.log('No active persona found. Exiting.');
    process.exit(0);
  }

  // 2. Determine Branch (for context)
  const branchLabel = labels.find(l => l.startsWith('branch:'));
  const currentBranch = branchLabel ? branchLabel.split(':')[1].trim() : 'main';

  console.log(`Activating persona: ${persona} on branch: ${currentBranch}`);

  // 3. Load Prompt
  const promptPath = path.join(__dirname, '..', 'prompts', `${persona}.md`);
  if (!fs.existsSync(promptPath)) {
    console.error(`Prompt not found for persona: ${persona}`);
    process.exit(1);
  }
  const systemPrompt = fs.readFileSync(promptPath, 'utf8');

  // 4. Prepare Context
  const context = `
Issue #${issueNumber}
Repository: ${repository}
Issue URL: ${issueUrl}
Project: ${projectUrl || 'N/A'} (#${projectNumber || 'N/A'})
Current Branch: ${currentBranch}
Labels: ${labels.join(', ')}
---
ISSUE BODY:
${issueBody}
---
LATEST COMMENT:
${commentBody}
`;

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) {
    console.error('Gemini API key not set. Configure GEMINI_API_KEY in GitHub Actions secrets or a local .env file.');
    process.exit(1);
  }

  const verifiedRepo = verifyGitHubCli(repository, issueNumber);
  console.log(`Verified GitHub CLI access to ${verifiedRepo}`);

  // Ensure downstream tools (like gh) use the correct repository
  process.env.GITHUB_REPOSITORY = repository;

  const prompt = `${systemPrompt}\n\n${context}
---
ENVIRONMENT:
- GitHub CLI repository access has been preflight-verified for ${verifiedRepo}.
- If a gh command fails, report the exact command and stderr instead of inferring an authentication problem.`;

  // Invoke the official CLI package in headless mode so Actions does not depend on a preinstalled binary.
  const args = [
    '-y',
    '@google/gemini-cli',
    '--prompt',
    prompt,
    '--approval-mode',
    'yolo'
  ];

  console.log('Invoking Gemini CLI...');
  const childEnv = buildGeminiEnv();
  
  // The target repository is at the root (../ from .conductor/dist/src or ../ from .conductor if running via npm start)
  // In Actions, GITHUB_WORKSPACE is the root.
  const targetCwd = process.env.GITHUB_WORKSPACE || path.resolve(process.cwd(), '..');
  const result = await runStreamingCommand('npx', args, childEnv, targetCwd);

  if (result.status !== 0) {
    console.error('Gemini CLI execution failed');

    const errorOutput = (result.stderr || result.stdout || 'No output captured').trim();
    const lines = errorOutput.split('\n');
    const snippet = lines.length > 50 ? lines.slice(-50).join('\n') : errorOutput;

    const body = `### ❌ Gemini CLI Execution Failed

**Exit Code**: ${result.status}

<details>
<summary>Error Snippet (Last 50 lines)</summary>

\`\`\`
${snippet}
\`\`\`
</details>

*Automated report by Conductor*`;

    console.log('Posting failure comment to GitHub...');
    spawnSync('gh', ['issue', 'comment', String(issueNumber), '-R', repository, '--body', body], {
      stdio: 'inherit',
      env: childEnv
    });

    process.exit(result.status || 1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
