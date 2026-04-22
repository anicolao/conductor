import type { ConductorEvent } from "./logger";
import { ConductorEventSchema } from "./logger";

const EVENT_MARKER = "::CONDUCTOR_EVENT::";

export function parseLogs(logs: string): ConductorEvent[] {
	const events: ConductorEvent[] = [];
	const lines = logs.split("\n");

	for (const line of lines) {
		if (line.includes(EVENT_MARKER)) {
			const parts = line.split(EVENT_MARKER);
			// We take the last part in case the marker appears multiple times or as part of other text
			const jsonStr = parts[parts.length - 1].trim();

			// Basic check for completeness before trying to parse
			if (!jsonStr.startsWith("{") || !jsonStr.endsWith("}")) {
				continue;
			}

			try {
				const event = ConductorEventSchema.parse(JSON.parse(jsonStr));
				events.push(event);
			} catch (e) {
				// Only log error if it looks like it SHOULD have been a complete JSON
				console.error("Failed to parse conductor event:", jsonStr, e);
			}
		} else if (line.includes("[MESSAGE_BUS] publish:")) {
			const match = line.match(/\[MESSAGE_BUS\] publish:\s*(\{.*\})/);
			if (match) {
				try {
					const rawData = JSON.parse(match[1]);
					const data = {
						...rawData,
						_isMessageBus: true,
					};

					events.push(
						ConductorEventSchema.parse({
							v: 1,
							ts: new Date().toISOString(),
							event: "GEMINI_EVENT",
							data,
						}),
					);
				} catch (e) {
					console.error("Failed to parse message bus event:", match[1], e);
				}
			}
		}
	}

	return events;
}
