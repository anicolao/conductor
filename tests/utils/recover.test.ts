import { describe, expect, it } from 'vitest';

import {
  findOrphanedItems,
  hasActiveRun,
  normalizePersona,
  parseRunTarget,
  ProjectIssueItem
} from '../../src/utils/recover';

describe('recover utils', () => {
  it('parses conductor run titles into repository and issue number', () => {
    expect(parseRunTarget('Conductor [LLM-Orchestration/conductor] Issue #53 - Persona: coder - Event: repository_dispatch')).toEqual({
      repository: 'LLM-Orchestration/conductor',
      issueNumber: 53
    });
  });

  it('returns null for non-conductor titles', () => {
    expect(parseRunTarget('CI run')).toBeNull();
  });

  it('detects an active run for a matching issue', () => {
    const item: ProjectIssueItem = {
      repository: 'LLM-Orchestration/conductor',
      issueNumber: 53,
      issueUrl: 'https://github.com/LLM-Orchestration/conductor/issues/53',
      projectNumber: 1,
      projectUrl: 'https://github.com/orgs/LLM-Orchestration/projects/1',
      status: 'In Progress',
      persona: 'coder'
    };

    expect(hasActiveRun(item, [
      { status: 'queued', display_title: 'Conductor [LLM-Orchestration/conductor] Issue #53 - Persona: coder - Event: repository_dispatch' }
    ])).toBe(true);
  });

  it('finds only in-progress items without an active conductor run', () => {
    const items: ProjectIssueItem[] = [
      {
        repository: 'LLM-Orchestration/conductor',
        issueNumber: 53,
        issueUrl: 'https://github.com/LLM-Orchestration/conductor/issues/53',
        projectNumber: 1,
        projectUrl: 'https://github.com/orgs/LLM-Orchestration/projects/1',
        status: 'In Progress',
        persona: 'coder'
      },
      {
        repository: 'LLM-Orchestration/conductor',
        issueNumber: 54,
        issueUrl: 'https://github.com/LLM-Orchestration/conductor/issues/54',
        projectNumber: 1,
        projectUrl: 'https://github.com/orgs/LLM-Orchestration/projects/1',
        status: 'Done',
        persona: 'conductor'
      }
    ];

    expect(findOrphanedItems(items, [
      { status: 'in_progress', display_title: 'Conductor [LLM-Orchestration/conductor] Issue #54 - Persona: conductor - Event: repository_dispatch' }
    ])).toEqual([items[0]]);
  });

  it('defaults missing or unknown persona to conductor', () => {
    expect(normalizePersona('coder')).toBe('coder');
    expect(normalizePersona('conductor')).toBe('conductor');
    expect(normalizePersona(null)).toBe('conductor');
    expect(normalizePersona('reviewer')).toBe('conductor');
  });
});
