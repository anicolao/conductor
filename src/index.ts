import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

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

async function main() {
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

  // 5. Invoke Gemini CLI
  const args = [
    '--system', systemPrompt,
    '--prompt', context
  ];

  console.log('Invoking Gemini CLI...');
  const result = spawnSync('gemini', args, {
    stdio: 'inherit',
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    console.error('Gemini CLI execution failed');
    process.exit(result.status || 1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
