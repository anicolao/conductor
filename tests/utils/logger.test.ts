import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { logEvent, logger } from '../../src/utils/logger';

describe('logger', () => {
  let stdoutSpy: MockInstance;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.env.GITHUB_RUN_ID = '12345';
    process.env.GITHUB_REPOSITORY = 'test/repo';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log a structured event to stdout', () => {
    logEvent('LOG_INFO', { message: 'test message' }, { persona: 'test_persona', issue: 42 });

    expect(stdoutSpy).toHaveBeenCalled();
    const output = stdoutSpy.mock.calls[0][0] as string;
    expect(output).toContain('::CONDUCTOR_EVENT::');
    
    const jsonStr = output.split('::CONDUCTOR_EVENT::')[1];
    const payload = JSON.parse(jsonStr);

    expect(payload.v).toBe(1);
    expect(payload.event).toBe('LOG_INFO');
    expect(payload.data).toEqual({ message: 'test message' });
    expect(payload.persona).toBe('test_persona');
    expect(payload.issue).toBe(42);
    expect(payload.run_id).toBe('12345');
    expect(payload.repo).toBe('test/repo');
    expect(payload.ts).toBeDefined();
  });

  it('should use environment variables as fallback', () => {
    process.env.CONDUCTOR_PERSONA = 'env_persona';
    process.env.CONDUCTOR_ISSUE = '99';

    logEvent('LOG_INFO', { message: 'env test' });

    const output = stdoutSpy.mock.calls[0][0] as string;
    const payload = JSON.parse(output.split('::CONDUCTOR_EVENT::')[1]);

    expect(payload.persona).toBe('env_persona');
    expect(payload.issue).toBe(99);
  });

  it('logger.info should log LOG_INFO event', () => {
    logger.info('hello world');
    const output = stdoutSpy.mock.calls[0][0];
    const payload = JSON.parse(output.split('::CONDUCTOR_EVENT::')[1]);
    expect(payload.event).toBe('LOG_INFO');
    expect(payload.data.message).toBe('hello world');
  });

  it('logger.error should log LOG_ERROR event with extra data', () => {
    logger.error('oops', { code: 500 });
    const output = stdoutSpy.mock.calls[0][0];
    const payload = JSON.parse(output.split('::CONDUCTOR_EVENT::')[1]);
    expect(payload.event).toBe('LOG_ERROR');
    expect(payload.data.message).toBe('oops');
    expect(payload.data.code).toBe(500);
  });

  it('logger.stdout should log STDOUT event', () => {
    logger.stdout('some command output');
    const output = stdoutSpy.mock.calls[0][0];
    const payload = JSON.parse(output.split('::CONDUCTOR_EVENT::')[1]);
    expect(payload.event).toBe('STDOUT');
    expect(payload.data.text).toBe('some command output');
  });
});
