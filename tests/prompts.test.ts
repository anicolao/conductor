import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPrompts } from "../src/index";

describe("loadPrompts", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "conductor-prompts-test-"));
		fs.mkdirSync(path.join(tmpDir, "prompts"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("should load both efficiency and persona prompts", () => {
		fs.writeFileSync(
			path.join(tmpDir, "prompts", "efficiency.md"),
			"efficiency content",
		);
		fs.writeFileSync(
			path.join(tmpDir, "prompts", "conductor.md"),
			"conductor content",
		);

		const result = loadPrompts(tmpDir, "conductor");
		expect(result).toBe("efficiency content\n\nconductor content");
	});

	it("should load only persona prompt if efficiency is missing", () => {
		fs.writeFileSync(
			path.join(tmpDir, "prompts", "conductor.md"),
			"conductor content",
		);

		const result = loadPrompts(tmpDir, "conductor");
		expect(result).toBe("conductor content");
	});

	it("should throw/exit if persona prompt is missing", () => {
		// Mocking process.exit to avoid killing the test runner
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit");
		});

		expect(() => loadPrompts(tmpDir, "nonexistent")).toThrow("process.exit");
		exitSpy.mockRestore();
	});
});
