import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import dotenv from 'dotenv';

interface GitHubEvent {
  issue?: {
    number: number;
    labels: { name: string }[];
    body: string;
  };
  comment?: {
    body: string;
  };
}

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function formatStreamChunk(chunk: string, source: 'stdout' | 'stderr'): string {
  return source === 'stderr' ? `[stderr] ${chunk}` : chunk;
}

export function createLineForwarder(source: 'stdout' | 'stderr', onChunk: (formatted: string, raw: string, source: 'stdout' | 'stderr') => void) {
  let buffer = '';

  return {
    push(chunk: string) {
      buffer += chunk;

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex + 1);
        buffer = buffer.slice(newlineIndex + 1);
        onChunk(formatStreamChunk(line, source), line, source);
      }
    },
    flush() {
      if (!buffer) return;
      onChunk(formatStreamChunk(buffer, source), buffer, source);
      buffer = '';
    }
  };
}

async function runStreamingCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    const stdoutForwarder = createLineForwarder('stdout', (formatted, raw) => {
      stdout += raw;
      process.stdout.write(formatted);
    });
    const stderrForwarder = createLineForwarder('stderr', (formatted, raw) => {
      stderr += raw;
      process.stdout.write(formatted);
    });

    child.stdout.on('data', chunk => {
      stdoutForwarder.push(String(chunk));
    });

    child.stderr.on('data', chunk => {
      stderrForwarder.push(String(chunk));
    });

    child.on('error', reject);

    child.on('close', code => {
      stdoutForwarder.flush();
      stderrForwarder.flush();
      resolve({
        status: code ?? 1,
        stdout,
        stderr
      });
    });
  });
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

async function main() {
  dotenv.config();

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error('GITHUB_EVENT_PATH not set');
    process.exit(1);
  }

  const event: GitHubEvent = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const issueNumber = event.issue?.number;
  if (!issueNumber) {
    console.error('No issue number found in event');
    process.exit(0);
  }

  // 1. Determine Persona
  let persona: 'conductor' | 'coder' | null = null;
  const labels = event.issue?.labels.map(l => l.name) || [];
  
  if (labels.includes('persona: coder')) {
    persona = 'coder';
  } else if (labels.includes('persona: conductor')) {
    persona = 'conductor';
  } else {
    // Implicit initiation check
    const body = event.comment?.body || event.issue?.body || '';
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
${event.issue?.body || ''}
---
LATEST COMMENT:
${event.comment?.body || ''}
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
