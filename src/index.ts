import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';

import { runStreamingCommand } from './utils/exec';
import { DEFAULT_COMMENT_LIMIT, resolveCommentLimit } from './utils/comment-limit';
import { GitHubEvent, extractEventData, extractMediaUrls } from './utils/github';
import { logEvent, logger } from './utils/logger';

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

    logger.error(`GitHub CLI preflight failed for ${repository}.`);
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

function hasGeminiOAuthCredentials(): boolean {
  const home = process.env.HOME;
  if (!home) return false;

  const credsPath = path.join(home, '.gemini', 'oauth_creds.json');

  try {
    const raw = fs.readFileSync(credsPath, 'utf8').trim();
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

function loadIssueState(repository: string, issueNumber: number): { 
  labels: string[]; 
  body: string; 
  latestComment: string;
  latestCommentUrl: string;
  commentCount: number;
  htmlUrl: string;
  nodeId: string;
} | null {
  const issueData = spawnSync('gh', ['api', `repos/${repository}/issues/${issueNumber}`], {
    encoding: 'utf8',
    env: process.env
  });

  if (issueData.status !== 0 || !issueData.stdout.trim()) {
    return null;
  }

  const parsed = JSON.parse(issueData.stdout);

  // Fetch latest comment
  const commentsData = spawnSync('gh', ['api', `repos/${repository}/issues/${issueNumber}/comments`, '--jq', '. [-1] | {body: .body, html_url: .html_url} // empty'], {
    encoding: 'utf8',
    env: process.env
  });

  let latestComment = '';
  let latestCommentUrl = '';
  if (commentsData.status === 0 && commentsData.stdout.trim()) {
    try {
      const commentParsed = JSON.parse(commentsData.stdout);
      latestComment = commentParsed.body || '';
      latestCommentUrl = commentParsed.html_url || '';
    } catch {
      // ignore
    }
  }

  return {
    labels: Array.isArray(parsed.labels) ? parsed.labels.map((label: { name: string }) => label.name) : [],
    body: parsed.body || '',
    latestComment,
    latestCommentUrl,
    commentCount: typeof parsed.comments === 'number' ? parsed.comments : 0,
    htmlUrl: parsed.html_url || '',
    nodeId: parsed.node_id || ''
  };
}

function loadIssueCommentBodies(repository: string, issueNumber: number, commentCount: number): string[] {
  if (commentCount < 1) return [];

  const perPage = 100;
  const pages = Math.ceil(commentCount / perPage);
  const bodies: string[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const commentsData = spawnSync('gh', ['api', `repos/${repository}/issues/${issueNumber}/comments?per_page=${perPage}&page=${page}`], {
      encoding: 'utf8',
      env: process.env
    });

    if (commentsData.status !== 0 || !commentsData.stdout.trim()) {
      const details = (commentsData.stderr || commentsData.stdout || 'No gh output captured').trim();
      logger.warn(
        `Failed to load comment page ${page} for ${repository}#${issueNumber}; ` +
        'falling back to the default comment limit.'
      );
      if (details) process.stderr.write(`${details}\n`);
      return [];
    }

    const parsed = JSON.parse(commentsData.stdout) as Array<{ body?: string | null }>;
    for (const comment of parsed) {
      bodies.push(comment.body || '');
    }
  }

  return bodies;
}

function moveToHumanReview(
  repository: string,
  issueNumber: number,
  issueNodeId: string,
  projectNumber: number | null,
  projectUrl: string,
  commentCount: number,
  commentLimit: number
): void {
  const body = `### Comment Limit Reached

Automation is aborting for this issue because the comment count exceeded the configured limit.

- Current comments: ${commentCount}
- Comment limit: ${commentLimit}

If you need more automated iterations on this issue, add a comment with:

\`SET COMMENT LIMIT: NNN\`

Then move the item back to \`In Progress\`.

*Automated report by Conductor*`;

  const args = [
    'run',
    'human-review',
    '--',
    '--issue-number',
    String(issueNumber),
    '--repo',
    repository
  ];

  if (issueNodeId) {
    args.push('--issue-node-id', issueNodeId);
  }

  if (projectNumber !== null) {
    args.push('--project-number', String(projectNumber));
  }

  if (projectUrl) {
    args.push('--project-url', projectUrl);
  }

  const result = spawnSync('npm', args, {
    encoding: 'utf8',
    env: process.env,
    input: body
  });

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || 'No output captured').trim();
    logger.error(`Failed to move ${repository}#${issueNumber} to Human Review after comment-limit check.`);
    if (details) process.stderr.write(`${details}\n`);
    process.exit(result.status || 1);
  }
}

function activatePersonaLabel(repository: string, issueNumber: number, persona: 'conductor' | 'coder'): void {
  const result = spawnSync('gh', ['issue', 'edit', String(issueNumber), '-R', repository, '--add-label', `persona: ${persona}`], {
    encoding: 'utf8',
    env: process.env
  });

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || 'No gh output captured').trim();
    logger.error(`Failed to activate ${persona} persona on issue #${issueNumber} in ${repository}`);
    if (details) process.stderr.write(`${details}\n`);
  }
}

function postPickupNote(repository: string, issueNumber: number, persona: string, branch: string): void {
  const body = `The **${persona}** has picked up this task and is working on **${branch}**.`;
  
  logger.info(`Posting pickup note to issue #${issueNumber} in ${repository}...`);
  
  try {
    const result = spawnSync('gh', ['issue', 'comment', String(issueNumber), '-R', repository, '--body', body], {
      stdio: 'inherit',
      env: process.env
    });

    if (result.error || result.status !== 0) {
      logger.error(`Failed to post pickup note to issue #${issueNumber} in ${repository}`);
      if (result.error) logger.error(result.error.message);
    } else {
      logger.info('Pickup note posted successfully.');
    }
  } catch (err) {
    logger.error(`Error attempting to post pickup note: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  dotenv.config();

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    logger.error('GITHUB_EVENT_PATH not set');
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
    commentUrl,
    projectNumber,
    projectUrl,
    eventName: extractedEventName,
    action
  } = extractEventData(event, process.env);

    let persona: 'conductor' | 'coder' | null = null;
    let lastCommentUrl = commentUrl;
    let allCommentBodies: string[] = [];

    try {
      if (!issueNumber) {
        logger.error('No issue number found in event');
        process.exit(0);
      }

      if (!repository) {
        logger.error('No repository found in event');
        process.exit(1);
      }

      const liveIssueState = loadIssueState(repository, issueNumber);
      if (liveIssueState) {
        labels = liveIssueState.labels;
        issueBody = liveIssueState.body;
        commentBody = liveIssueState.latestComment;
        lastCommentUrl = liveIssueState.latestCommentUrl;
        issueUrl = liveIssueState.htmlUrl;
        issueNodeId = liveIssueState.nodeId;

        if (liveIssueState.commentCount > DEFAULT_COMMENT_LIMIT) {
          allCommentBodies = loadIssueCommentBodies(repository, issueNumber, liveIssueState.commentCount);
        }

        const commentLimit = allCommentBodies.length > 0
          ? resolveCommentLimit(allCommentBodies, DEFAULT_COMMENT_LIMIT)
          : DEFAULT_COMMENT_LIMIT;

        if (liveIssueState.commentCount > commentLimit) {
          logger.info(
            `Comment limit exceeded for ${repository}#${issueNumber} ` +
            `(${liveIssueState.commentCount} > ${commentLimit}). Moving item to Human Review.`
          );
          moveToHumanReview(
            repository,
            issueNumber,
            issueNodeId,
            projectNumber ?? null,
            projectUrl || '',
            liveIssueState.commentCount,
            commentLimit
          );
          process.exit(0);
        }
      }

    if (eventName === 'repository_dispatch' && !labels.some(label => label.startsWith('persona:'))) {
      const targetPersona = (event.client_payload?.persona === 'coder' || event.client_payload?.persona === 'conductor') 
        ? event.client_payload.persona 
        : 'conductor';
      logger.info(`repository_dispatch received for issue #${issueNumber} in ${repository}. Activating ${targetPersona} persona.`);
      activatePersonaLabel(repository, issueNumber, targetPersona);
      labels.push(`persona: ${targetPersona}`);
    }

    // 1. Determine Persona
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
      logger.info('No active persona found. Exiting.');
      process.exit(0);
    }

    // 2. Determine Branch (for context)
    const branchLabel = labels.find(l => l.startsWith('branch:'));
    const currentBranch = branchLabel ? branchLabel.split(':')[1].trim() : 'main';

    logger.info(`Activating persona: ${persona} on branch: ${currentBranch}`);

    logEvent('session_start', { branch: currentBranch, labels }, { persona, issue: issueNumber });

    // Post pickup note (non-critical)
    postPickupNote(repository, issueNumber, persona, currentBranch);

    // 3. Load Prompt
    const promptPath = path.join(__dirname, '..', 'prompts', `${persona}.md`);
    if (!fs.existsSync(promptPath)) {
      logger.error(`Prompt not found for persona: ${persona}`);
      process.exit(1);
    }
    const systemPrompt = fs.readFileSync(promptPath, 'utf8');

    // 4. Prepare Context
    const context = `
Issue #${issueNumber}
Repository: ${repository}
Issue URL: ${issueUrl}
Issue Node ID: ${issueNodeId}
Project: ${projectUrl || 'N/A'} (#${projectNumber || 'N/A'})
Event: ${extractedEventName}${action ? ` (${action})` : ''}
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
    if (!geminiApiKey && !hasGeminiOAuthCredentials()) {
      logger.error(
        'Gemini auth not set. Configure GEMINI_API_KEY or GEMINI_OAUTH_CREDS_JSON in GitHub Actions, ' +
        'or authenticate locally so ~/.gemini/oauth_creds.json exists.'
      );
      process.exit(1);
    }

    const verifiedRepo = verifyGitHubCli(repository, issueNumber);
    logger.info(`Verified GitHub CLI access to ${verifiedRepo}`);

    // Ensure downstream tools (like gh) use the correct repository
    process.env.GITHUB_REPOSITORY = repository;

    const prompt = `${systemPrompt}\n\n${context}
---
ENVIRONMENT:
- GitHub CLI repository access has been preflight-verified for ${verifiedRepo}.
- If a gh command fails, report the exact command and stderr instead of inferring an authentication problem.`;

    // Extract media URLs from issue body, latest comment, and any other loaded comments
    const mediaUrls = new Set<string>([
      ...extractMediaUrls(issueBody),
      ...extractMediaUrls(commentBody),
      ...allCommentBodies.flatMap(body => extractMediaUrls(body))
    ]);

    // Invoke the official CLI package in headless mode so Actions does not depend on a preinstalled binary.
    const args = [
      '-y',
      '@google/gemini-cli',
      '--prompt',
      prompt,
      '--approval-mode',
      'yolo'
    ];

    for (const url of mediaUrls) {
      args.push('--media', url);
    }

    logger.info('Invoking Gemini CLI...');
    const childEnv = buildGeminiEnv();
    childEnv.CONDUCTOR_PERSONA = persona;
    childEnv.CONDUCTOR_LAST_COMMENT_URL = lastCommentUrl;
    
    // The target repository is at the root (../ from .conductor/dist/src or ../ from .conductor if running via npm start)
    // In Actions, GITHUB_WORKSPACE is the root.
    const targetCwd = process.env.GITHUB_WORKSPACE || path.resolve(process.cwd(), '..');
    const result = await runStreamingCommand('npx', args, childEnv, targetCwd);

    if (result.status !== 0) {
      logger.error('Gemini CLI execution failed');

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

      logger.info('Posting failure comment to GitHub...');
      spawnSync('gh', ['issue', 'comment', String(issueNumber), '-R', repository, '--body', body], {
        stdio: 'inherit',
        env: childEnv
      });

      logEvent('session_end', { status: 'failure', exitCode: result.status }, { persona, issue: issueNumber });
      process.exit(result.status || 1);
    }

    logEvent('session_end', { status: 'success' }, { persona, issue: issueNumber });
  } catch (error) {
    logger.error('An unexpected error occurred', { error: error instanceof Error ? error.message : String(error) });
    logEvent('session_end', { 
      status: 'failure', 
      error: error instanceof Error ? error.message : String(error) 
    }, { persona: persona || undefined, issue: issueNumber });
    process.exit(1);
  }
}

main().catch(err => {
  logger.error('Fatal error', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
