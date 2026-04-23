import { beforeEach, describe, expect, it, vi } from "vitest";
import { runStreamingCommand } from "../../src/utils/exec";
import { logEvent, logger } from "../../src/utils/logger";

vi.mock("../../src/utils/logger", () => ({
	logEvent: vi.fn(),
	logger: {
		stdout: vi.fn(),
		stderr: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

describe("JSON mode and Debug intercept", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should intercept GEMINI_EVENT from stdout", async () => {
		// We'll use sh -c to echo a JSON line
		const json = JSON.stringify({
			type: "init",
			session_id: "123",
			model: "gemini-pro",
			timestamp: "2026-04-23T12:00:00Z",
		});
		await runStreamingCommand("sh", ["-c", `echo '${json}'`], process.env);

		expect(logEvent).toHaveBeenCalledWith(
			"GEMINI_EVENT",
			expect.objectContaining({
				type: "init",
				session_id: "123",
				model: "gemini-pro",
			}),
		);
		expect(logger.stdout).not.toHaveBeenCalled();
	});

	it("should fallback to regular stdout if not valid JSON or missing type", async () => {
		await runStreamingCommand("sh", ["-c", "echo 'not json'"], process.env);
		expect(logger.stdout).toHaveBeenCalledWith("not json\n");
		expect(logEvent).not.toHaveBeenCalledWith(
			"GEMINI_EVENT",
			expect.any(Object),
		);

		vi.clearAllMocks();
		await runStreamingCommand(
			"sh",
			["-c", 'echo "{\\"no\\": \\"type\\"}"'],
			process.env,
		);
		expect(logger.stdout).toHaveBeenCalled();
		expect(logEvent).not.toHaveBeenCalledWith(
			"GEMINI_EVENT",
			expect.any(Object),
		);
	});

	it("should intercept debug logs from stderr", async () => {
		await runStreamingCommand(
			"sh",
			["-c", 'echo "[Routing] using model X" >&2'],
			process.env,
		);
		expect(logEvent).toHaveBeenCalledWith("LOG_DEBUG", {
			message: "[Routing] using model X",
		});
		expect(logger.stderr).not.toHaveBeenCalled();

		vi.clearAllMocks();
		await runStreamingCommand(
			"sh",
			["-c", 'echo "[Memory] current size" >&2'],
			process.env,
		);
		expect(logEvent).toHaveBeenCalledWith("LOG_DEBUG", {
			message: "[Memory] current size",
		});

		vi.clearAllMocks();
		await runStreamingCommand(
			"sh",
			["-c", 'echo "[Status] thinking" >&2'],
			process.env,
		);
		expect(logEvent).toHaveBeenCalledWith("LOG_DEBUG", {
			message: "[Status] thinking",
		});
	});

	it("should fallback to regular stderr for other logs", async () => {
		await runStreamingCommand(
			"sh",
			["-c", 'echo "some error" >&2'],
			process.env,
		);
		expect(logger.stderr).toHaveBeenCalledWith("[stderr] some error\n");
		expect(logEvent).not.toHaveBeenCalledWith("LOG_DEBUG", expect.any(Object));
	});
});
