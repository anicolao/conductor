import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import dotenv from 'dotenv';

import { CommandResult, runStreamingCommand } from './utils/exec';

interface GitHubEvent {
  action?: string;
  issue?: {
    number: number;
    labels: { name: string }[];
    body: string;
  };
  comment?: {
    body: string;
  };
  client_payload?: {
    issue_number?: number;
    project_number?: number;
    project_url?: string;
    status?: string;
  };
}

function verifyGitHubCli(issueNumber: number): string {
  const repoCheck = spawnSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], {
    encoding: 'utf8',
    env: process.env
  });

  if (repoCheck.status !== 0) {
    const authStatus = spawnSync('gh', ['auth', 'status'], {
      encoding: 'utf8',
      env: process.env
    });

    const failureDetails = (repoCheck.stderr || repoCheck.stdout || authStatus.stderr || authStatus.stdout || 'No gh output captured').trim();

    console.error('GitHub CLI preflight failed.');
    if (failureDetails) process.stderr.write(`${failureDetails}\n`);

    const body = `### ❌ GitHub CLI Preflight Failed

Issue #${issueNumber} could not verify \`gh\` access before invoking Gemini.

<details>
<summary>Preflight output</summary>

\`\`\`
${failureDetails}
\`\`\`
</details>

*Automated report by Conductor*`;

    spawnSync('gh', ['issue', 'comment', String(issueNumber), '--body', body], {
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

function loadIssueState(issueNumber: number): { labels: string[]; body: string } | null {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return null;
  }

  const issueData = spawnSync('gh', ['api', `repos/${repository}/issues/${issueNumber}`], {
    encoding: 'utf8',
    env: process.env
  });

  if (issueData.status !== 0 || !issueData.stdout.trim()) {
    return null;
  }

  const parsed = JSON.parse(issueData.stdout);
  return {
    labels: Array.isArray(parsed.labels) ? parsed.labels.map((label: { name: string }) => label.name) : [],
    body: parsed.body || ''
  };
}

function activateConductorPersona(issueNumber: number): void {
  const result = spawnSync('gh', ['issue', 'edit', String(issueNumber), '--add-label', 'persona: conductor'], {
    encoding: 'utf8',
    env: process.env
  });

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || 'No gh output captured').trim();
    console.error(`Failed to activate conductor persona on issue #${issueNumber}`);
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
  let issueNumber = event.issue?.number ?? event.client_payload?.issue_number;
  let labels = event.issue?.labels.map(l => l.name) || [];
  let issueBody = event.issue?.body || '';
  let commentBody = event.comment?.body || '';

  if (!issueNumber) {
    console.error('No issue number found in event');
    process.exit(0);
  }

  const liveIssueState = loadIssueState(issueNumber);
  if (liveIssueState) {
    labels = liveIssueState.labels;
    issueBody = liveIssueState.body;
  }

  if (eventName === 'repository_dispatch' && !labels.some(label => label.startsWith('persona:'))) {
    console.log(`repository_dispatch received for issue #${issueNumber}. Activating conductor persona.`);
    activateConductorPersona(issueNumber);
    labels.push('persona: conductor');
  }

  // 1. Determine Persona
  let persona: 'conductor' | 'coder' | null = null;
  
  if (labels.includes('persona: coder')) {
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

  const verifiedRepo = verifyGitHubCli(issueNumber);
  console.log(`Verified GitHub CLI access to ${verifiedRepo}`);

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
  const result = await runStreamingCommand('npx', args, childEnv);

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
    spawnSync('gh', ['issue', 'comment', String(issueNumber), '--body', body], {
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
