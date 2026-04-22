import { describe, it, expect } from "vitest";
import { sanitize } from "../../src/utils/sanitize";

describe("sanitize", () => {
	it("removes null bytes from a string", () => {
		const input = "hello\0world\0";
		const expected = "helloworld";
		expect(sanitize(input)).toBe(expected);
	});

	it("returns the same string if no null bytes are present", () => {
		const input = "hello world";
		expect(sanitize(input)).toBe(input);
	});

	it("handles empty strings", () => {
		expect(sanitize("")).toBe("");
	});
});
