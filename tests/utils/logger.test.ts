import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logEvent } from '../../src/utils/logger';

describe('logger', () => {
  let stdoutSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.env.GITHUB_RUN_ID = '12345';
    process.env.GITHUB_REPOSITORY = 'test/repo';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log a structured event to stdout', () => {
    logEvent('test_event', { foo: 'bar' }, { persona: 'test_persona', issue: 42 });

    expect(stdoutSpy).toHaveBeenCalled();
    const output = stdoutSpy.mock.calls[0][0];
    expect(output).toContain('::CONDUCTOR_EVENT::');
    
    const jsonStr = output.split('::CONDUCTOR_EVENT::')[1];
    const payload = JSON.parse(jsonStr);

    expect(payload.v).toBe(1);
    expect(payload.event).toBe('test_event');
    expect(payload.data).toEqual({ foo: 'bar' });
    expect(payload.persona).toBe('test_persona');
    expect(payload.issue).toBe(42);
    expect(payload.run_id).toBe('12345');
    expect(payload.repo).toBe('test/repo');
    expect(payload.ts).toBeDefined();
  });

  it('should use environment variables as fallback', () => {
    process.env.CONDUCTOR_PERSONA = 'env_persona';
    process.env.CONDUCTOR_ISSUE = '99';

    logEvent('test_event', {});

    const output = stdoutSpy.mock.calls[0][0];
    const payload = JSON.parse(output.split('::CONDUCTOR_EVENT::')[1]);

    expect(payload.persona).toBe('env_persona');
    expect(payload.issue).toBe(99);
  });
});
