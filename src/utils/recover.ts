export interface ProjectIssueItem {
  repository: string;
  issueNumber: number;
  issueUrl: string;
  issueNodeId: string;
  projectNumber: number;
  projectUrl: string;
  status: string;
  persona: 'conductor' | 'coder' | null;
}

export interface ConductorWorkflowRun {
  status: string;
  display_title?: string | null;
}

export interface RunTarget {
  repository: string;
  issueNumber: number;
}

const CONDUCTOR_RUN_TITLE = /^Conductor \[(.+)\] Issue #(\d+)\b/;
const RECOVERY_RUN_SUFFIX = 'Event: schedule (recover_orphaned_in_progress)';

export function parseRunTarget(displayTitle?: string | null): RunTarget | null {
  if (!displayTitle) return null;

  const match = displayTitle.match(CONDUCTOR_RUN_TITLE);
  if (!match) return null;

  return {
    repository: match[1],
    issueNumber: Number(match[2])
  };
}

export function normalizePersona(persona?: string | null): 'conductor' | 'coder' {
  return persona === 'coder' ? 'coder' : 'conductor';
}

export function isRecoveryRun(run: ConductorWorkflowRun): boolean {
  return typeof run.display_title === 'string' && run.display_title.includes(RECOVERY_RUN_SUFFIX);
}

export function hasActiveRun(item: ProjectIssueItem, runs: ConductorWorkflowRun[]): boolean {
  return runs.some(run => {
    if (run.status === 'completed') return false;

    const target = parseRunTarget(run.display_title);
    return target?.repository === item.repository && target.issueNumber === item.issueNumber;
  });
}

export function countRecoveryAttempts(item: ProjectIssueItem, runs: ConductorWorkflowRun[]): number {
  return runs.filter(run => {
    if (!isRecoveryRun(run)) return false;

    const target = parseRunTarget(run.display_title);
    return target?.repository === item.repository && target.issueNumber === item.issueNumber;
  }).length;
}

export function findOrphanedItems(items: ProjectIssueItem[], runs: ConductorWorkflowRun[]): ProjectIssueItem[] {
  return items.filter(item => item.status === 'In Progress' && !hasActiveRun(item, runs));
}
