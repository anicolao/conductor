export const RUNNING_LABEL = 'workflow: running';
export const IN_PROGRESS_STATUS = 'In Progress';

export interface ProjectIssueItem {
  repository: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  issueBody: string;
  labels: string[];
  status: string | null;
  persona: 'conductor' | 'coder' | null;
  projectNumber: number;
  projectUrl: string;
}

export interface RecoveryCandidate extends ProjectIssueItem {
  targetPersona: 'conductor' | 'coder';
}

export function resolveTargetPersona(item: Pick<ProjectIssueItem, 'persona' | 'labels'>): 'conductor' | 'coder' {
  if (item.persona === 'conductor' || item.persona === 'coder') {
    return item.persona;
  }

  if (item.labels.includes('persona: coder')) {
    return 'coder';
  }

  return 'conductor';
}

export function selectRecoveryCandidates(items: ProjectIssueItem[]): RecoveryCandidate[] {
  return items
    .filter((item) => item.status === IN_PROGRESS_STATUS)
    .filter((item) => !item.labels.includes(RUNNING_LABEL))
    .map((item) => ({
      ...item,
      targetPersona: resolveTargetPersona(item)
    }));
}

export function buildRecoveryPrompt(item: RecoveryCandidate): string {
  return [
    `Recovery watchdog detected that ${item.repository}#${item.issueNumber} is still in "${IN_PROGRESS_STATUS}" on the AI Orchestration project, but no active workflow-owned \`${RUNNING_LABEL}\` label is present.`,
    '',
    'Resume from the current live issue, branch, and project state.',
    'If the work is already complete, perform the normal completion path now so the item no longer appears stalled.',
    'If the work is not complete, continue or hand off explicitly. Do not exit without leaving the issue in a recoverable state.',
    '',
    `Issue: ${item.issueTitle}`,
    `Project: ${item.projectUrl}`,
    `Recovered Persona: ${item.targetPersona}`
  ].join('\n');
}
