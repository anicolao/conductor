import path from "node:path";
import { describe, expect, it } from "vitest";
import { runStreamingCommand } from "../src/utils/exec";

describe("handoff script validation", () => {
	it("should pass all handoff validation tests", async () => {
		const scriptPath = path.resolve(__dirname, "./handoff_test.sh");
		const result = await runStreamingCommand("bash", [scriptPath], process.env);

		if (result.status !== 0) {
			console.error(result.stdout);
			console.error(result.stderr);
		}

		expect(result.status).toBe(0);
	}, 30000); // Higher timeout for the verification loops
});
