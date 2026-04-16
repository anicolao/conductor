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
      
      // Basic check for completeness before trying to parse
      if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
        continue;
      }

      try {
        const event = JSON.parse(jsonStr) as ConductorEvent;
        events.push(event);
      } catch (e) {
        // Only log error if it looks like it SHOULD have been a complete JSON
        console.error('Failed to parse conductor event:', jsonStr, e);
      }
    }
  }

  return events;
}
