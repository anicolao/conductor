import { describe, expect, it } from "vitest";

import {
	DEFAULT_COMMENT_LIMIT,
	resolveCommentLimit,
} from "../../src/utils/comment-limit";

describe("comment limit utils", () => {
	it("uses the default limit when no command is present", () => {
		expect(
			resolveCommentLimit(["No control command here.", "Still no override."]),
		).toBe(DEFAULT_COMMENT_LIMIT);
	});

	it("uses the last valid command found across comments", () => {
		expect(
			resolveCommentLimit([
				"SET COMMENT LIMIT: 125",
				"Some discussion",
				"SET COMMENT LIMIT: 175",
			]),
		).toBe(175);
	});

	it("ignores invalid or non-positive limit commands", () => {
		expect(
			resolveCommentLimit([
				"SET COMMENT LIMIT: nope",
				"SET COMMENT LIMIT: 0",
				"SET COMMENT LIMIT: -4",
				"SET COMMENT LIMIT: 220",
			]),
		).toBe(220);
	});
});
