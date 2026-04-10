import { describe, expect, it } from 'vitest';

import {
  IN_PROGRESS_STATUS,
  RUNNING_LABEL,
  buildRecoveryPrompt,
  resolveTargetPersona,
  selectRecoveryCandidates,
  type ProjectIssueItem
} from '../../src/utils/recovery';

function makeItem(overrides: Partial<ProjectIssueItem> = {}): ProjectIssueItem {
  return {
    repository: 'LLM-Orchestration/conductor',
    issueNumber: 45,
    issueTitle: 'support cross-repository work',
    issueUrl: 'https://github.com/LLM-Orchestration/conductor/issues/45',
    issueBody: 'body',
    labels: [],
    status: IN_PROGRESS_STATUS,
    persona: 'conductor',
    projectNumber: 1,
    projectUrl: 'https://github.com/orgs/LLM-Orchestration/projects/1',
    ...overrides
  };
}

describe('recovery helpers', () => {
  it('prefers an explicit persona when present', () => {
    expect(resolveTargetPersona(makeItem({ persona: 'coder', labels: ['persona: conductor'] }))).toBe('coder');
  });

  it('falls back to labels and then conductor', () => {
    expect(resolveTargetPersona(makeItem({ persona: null, labels: ['persona: coder'] }))).toBe('coder');
    expect(resolveTargetPersona(makeItem({ persona: null, labels: [] }))).toBe('conductor');
  });

  it('selects only in-progress items missing the running label', () => {
    const candidates = selectRecoveryCandidates([
      makeItem(),
      makeItem({ issueNumber: 46, labels: [RUNNING_LABEL] }),
      makeItem({ issueNumber: 47, status: 'Todo' })
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.issueNumber).toBe(45);
  });

  it('builds a recovery prompt with the critical recovery instructions', () => {
    const prompt = buildRecoveryPrompt({
      ...makeItem(),
      targetPersona: 'coder'
    });

    expect(prompt).toContain(RUNNING_LABEL);
    expect(prompt).toContain('Recovered Persona: coder');
    expect(prompt).toContain('support cross-repository work');
  });
});
