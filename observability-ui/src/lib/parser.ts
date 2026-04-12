import type { ConductorEvent } from './types';

const EVENT_MARKER = '::CONDUCTOR_EVENT::';

export function parseLogs(logs: string): ConductorEvent[] {
  const events: ConductorEvent[] = [];
  const lines = logs.split('\n');

  for (const line of lines) {
    if (line.includes(EVENT_MARKER)) {
      const parts = line.split(EVENT_MARKER);
      // We take the last part in case the marker appears multiple times or as part of other text
      const jsonStr = parts[parts.length - 1].trim();
      try {
        const event = JSON.parse(jsonStr) as ConductorEvent;
        events.push(event);
      } catch (e) {
        console.error('Failed to parse conductor event:', jsonStr, e);
      }
    }
  }

  return events;
}
