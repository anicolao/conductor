import { z } from 'zod';

export interface ProjectIssueItem {
  repository: string;
  issueNumber: number;
  issueNodeId: string;
  projectNumber: number;
  projectUrl: string;
  status: string;
  persona: 'conductor' | 'coder' | null;
}

export interface ProjectItemNode {
  status?: { name?: string | null } | null;
  persona?: { name?: string | null } | null;
  content?: {
    id?: string | null;
    number?: number | null;
    repository?: {
      nameWithOwner?: string | null;
    } | null;
  } | null;
}

export const ConductorWorkflowRunSchema = z.object({
  status: z.string(),
  display_title: z.string(),
}).passthrough();

export type ConductorWorkflowRun = z.infer<typeof ConductorWorkflowRunSchema>;

export interface RunTarget {
  repository: string;
  issueNumber: number;
}

const CONDUCTOR_RUN_TITLE = /^Conductor \[(.+)\] Issue #(\d+)\b/;
const RECOVERY_RUN_SUFFIX = 'Event: schedule (recover_orphaned_in_progress)';

export function parseRunTarget(displayTitle: string): RunTarget | null {
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

export function toProjectIssueItem(
  node: ProjectItemNode,
  projectNumber: number,
  projectUrl: string
): ProjectIssueItem | null {
  const repository = node.content?.repository?.nameWithOwner;
  const issueNumber = node.content?.number;
  const issueNodeId = node.content?.id;
  const status = node.status?.name;

  if (!repository || !issueNumber || !issueNodeId || !status) {
    return null;
  }

  return {
    repository,
    issueNumber,
    issueNodeId,
    projectNumber,
    projectUrl,
    status,
    persona: node.persona?.name === 'coder' || node.persona?.name === 'conductor' ? node.persona.name : null
  };
}

export function isRecoveryRun(run: ConductorWorkflowRun): boolean {
  return run.display_title.includes(RECOVERY_RUN_SUFFIX);
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
