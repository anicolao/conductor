import { describe, it, expect } from 'vitest';
import { parseLogs } from '../../observability-ui/src/lib/parser';

describe('parseLogs', () => {
  it('should parse conductor events from logs', () => {
    const logs = `
some prefix
2026-04-15T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"session_start","data":{"branch":"main"}}
some intermediate log
2026-04-15T12:00:05Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:05Z","event":"TASK","data":{"text":"Doing something"}}
some suffix
    `;
    const events = parseLogs(logs);
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('session_start');
    expect(events[1].event).toBe('TASK');
    expect(events[1].data.text).toBe('Doing something');
  });

  it('should skip invalid JSON', () => {
    const logs = `
2026-04-15T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"session_start","data":{"branch":"main"}}
2026-04-15T12:00:05Z ::CONDUCTOR_EVENT:: {invalid json}
2026-04-15T12:00:10Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:10Z","event":"session_end","data":{"status":"success"}}
    `;
    const events = parseLogs(logs);
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('session_start');
    expect(events[1].event).toBe('session_end');
  });

  it('should return empty array if no events found', () => {
    const logs = 'some regular logs\nwithout any markers';
    const events = parseLogs(logs);
    expect(events).toEqual([]);
  });

  it('should handle marker appearing multiple times in a line', () => {
    const logs = 'prefix ::CONDUCTOR_EVENT:: ignored ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"test","data":{}}';
    const events = parseLogs(logs);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('test');
  });

  it('should handle partial lines silently', () => {
    const logs = `
2026-04-15T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"session_start","data":{"branch":"main"}}
2026-04-15T12:00:05Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:0
2026-04-15T12:00:10Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:10Z","event":"session_end","data":{"status":"success"}}
    `;
    const events = parseLogs(logs);
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('session_start');
    expect(events[1].event).toBe('session_end');
  });
});
