import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildProjectDispatchPayload, normalizeDispatchPersona } = require('../../functions/project-dispatch.js');

describe('project dispatch payload', () => {
  it('omits persona when the project item persona is unset', () => {
    const payload = buildProjectDispatchPayload({
      repository: 'LLM-Orchestration/conductor',
      issueNumber: 157,
      issueNodeId: 'I_123',
      projectNumber: 1,
      projectUrl: 'https://github.com/orgs/LLM-Orchestration/projects/1',
      persona: null,
      eventName: 'projects_v2_item',
      action: 'edited'
    });

    expect(payload.client_payload).not.toHaveProperty('persona');
  });

  it('preserves valid persona values', () => {
    const payload = buildProjectDispatchPayload({
      repository: 'LLM-Orchestration/conductor',
      issueNumber: 157,
      issueNodeId: 'I_123',
      projectNumber: 1,
      projectUrl: 'https://github.com/orgs/LLM-Orchestration/projects/1',
      persona: 'coder',
      eventName: 'projects_v2_item',
      action: 'edited'
    });

    expect(payload.client_payload.persona).toBe('coder');
  });

  it('normalizes invalid persona values to undefined', () => {
    expect(normalizeDispatchPersona(null)).toBeUndefined();
    expect(normalizeDispatchPersona('')).toBeUndefined();
    expect(normalizeDispatchPersona('human')).toBeUndefined();
  });
});
