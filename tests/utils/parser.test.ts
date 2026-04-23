import { describe, expect, it } from "vitest";
import { parseLogs } from "../../src/utils/parser";

describe("parseLogs", () => {
	it("should parse conductor events from logs", () => {
		const logs = `
some prefix
2026-04-15T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"session_start","data":{"branch":"main","labels":[]}}
some intermediate log
2026-04-15T12:00:05Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:05Z","event":"TASK","data":{"message":"Doing something"}}
some suffix
    `;
		const events = parseLogs(logs);
		expect(events).toHaveLength(2);
		expect(events[0].event).toBe("session_start");
		expect(events[1].event).toBe("TASK");
		expect(events[1].data.message).toBe("Doing something");
	});

	it("should skip invalid JSON", () => {
		const logs = `
2026-04-15T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"session_start","data":{"branch":"main","labels":[]}}
2026-04-15T12:00:05Z ::CONDUCTOR_EVENT:: {invalid json}
2026-04-15T12:00:10Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:10Z","event":"session_end","data":{"status":"success"}}
    `;
		const events = parseLogs(logs);
		expect(events).toHaveLength(2);
		expect(events[0].event).toBe("session_start");
		expect(events[1].event).toBe("session_end");
	});

	it("should return empty array if no events found", () => {
		const logs = "some regular logs\nwithout any markers";
		const events = parseLogs(logs);
		expect(events).toEqual([]);
	});

	it("should handle marker appearing multiple times in a line", () => {
		const logs =
			'prefix ::CONDUCTOR_EVENT:: ignored ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"GEMINI_EVENT","data":{"type":"test"}}';
		const events = parseLogs(logs);
		expect(events).toHaveLength(1);
		expect(events[0].event).toBe("GEMINI_EVENT");
	});

	it("should handle partial lines silently", () => {
		const logs = `
2026-04-15T12:00:00Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:00Z","event":"session_start","data":{"branch":"main","labels":[]}}
2026-04-15T12:00:05Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:0
2026-04-15T12:00:10Z ::CONDUCTOR_EVENT:: {"v":1,"ts":"2026-04-15T12:00:10Z","event":"session_end","data":{"status":"success"}}
    `;
		const events = parseLogs(logs);
		expect(events).toHaveLength(2);
		expect(events[0].event).toBe("session_start");
		expect(events[1].event).toBe("session_end");
	});

	it("should parse message bus debug logs", () => {
		const logs = `
[stderr] [MESSAGE_BUS] publish: {"type":"tool-calls-update","toolCalls":[],"schedulerId":"root"}
some other log
[stderr] [MESSAGE_BUS] publish: {"type":"tool-calls-update","toolCalls":[{"id":"call_1","function":{"name":"read_file","arguments":"{}"}}],"schedulerId":"root"}
    `;
		const events = parseLogs(logs);
		expect(events).toHaveLength(2);
		expect(events[0].event).toBe("GEMINI_EVENT");
		expect(events[0].data.type).toBe("tool-calls-update");
		expect(events[0].data._isMessageBus).toBe(true);
		expect(events[1].event).toBe("GEMINI_EVENT");
		expect(events[1].data.toolCalls).toHaveLength(1);
		expect(events[1].data.toolCalls[0].function.name).toBe("read_file");
		expect(events[1].data.toolCalls[0].function.arguments).toBe("{}");
	});
});
