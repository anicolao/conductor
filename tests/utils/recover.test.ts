import { describe, expect, it } from "vitest";

import {
	countRecoveryAttempts,
	findOrphanedItems,
	hasActiveRun,
	isRecoveryRun,
	normalizePersona,
	type ProjectIssueItem,
	parseRunTarget,
	toProjectIssueItem,
} from "../../src/utils/recover";

describe("recover utils", () => {
	it("parses conductor run titles into repository and issue number", () => {
		expect(
			parseRunTarget(
				"Conductor [LLM-Orchestration/conductor] Issue #53 - Persona: coder - Event: repository_dispatch",
			),
		).toEqual({
			repository: "LLM-Orchestration/conductor",
			issueNumber: 53,
		});
	});

	it("returns null for non-conductor titles", () => {
		expect(parseRunTarget("CI run")).toBeNull();
	});

	it("detects watchdog recovery-triggered runs from their title", () => {
		expect(
			isRecoveryRun({
				status: "completed",
				display_title:
					"Conductor [LLM-Orchestration/conductor] Issue #53 - Persona: coder - Event: schedule (recover_orphaned_in_progress)",
			}),
		).toBe(true);

		expect(
			isRecoveryRun({
				status: "completed",
				display_title:
					"Conductor [LLM-Orchestration/conductor] Issue #53 - Persona: coder - Event: repository_dispatch",
			}),
		).toBe(false);
	});

	it("detects an active run for a matching issue", () => {
		const item: ProjectIssueItem = {
			repository: "LLM-Orchestration/conductor",
			issueNumber: 53,
			issueNodeId: "I_53",
			projectNumber: 1,
			projectUrl: "https://github.com/orgs/LLM-Orchestration/projects/1",
			status: "In Progress",
			persona: "coder",
		};

		expect(
			hasActiveRun(item, [
				{
					status: "queued",
					display_title:
						"Conductor [LLM-Orchestration/conductor] Issue #53 - Persona: coder - Event: repository_dispatch",
				},
			]),
		).toBe(true);
	});

	it("finds only in-progress items without an active conductor run", () => {
		const items: ProjectIssueItem[] = [
			{
				repository: "LLM-Orchestration/conductor",
				issueNumber: 53,
				issueNodeId: "I_53",
				projectNumber: 1,
				projectUrl: "https://github.com/orgs/LLM-Orchestration/projects/1",
				status: "In Progress",
				persona: "coder",
			},
			{
				repository: "LLM-Orchestration/conductor",
				issueNumber: 54,
				issueNodeId: "I_54",
				projectNumber: 1,
				projectUrl: "https://github.com/orgs/LLM-Orchestration/projects/1",
				status: "Done",
				persona: "conductor",
			},
		];

		expect(
			findOrphanedItems(items, [
				{
					status: "in_progress",
					display_title:
						"Conductor [LLM-Orchestration/conductor] Issue #54 - Persona: conductor - Event: repository_dispatch",
				},
			]),
		).toEqual([items[0]]);
	});

	it("counts only retry-mechanism attempts for the matching issue", () => {
		const item: ProjectIssueItem = {
			repository: "LLM-Orchestration/conductor",
			issueNumber: 53,
			issueNodeId: "I_53",
			projectNumber: 1,
			projectUrl: "https://github.com/orgs/LLM-Orchestration/projects/1",
			status: "In Progress",
			persona: "coder",
		};

		expect(
			countRecoveryAttempts(item, [
				{
					status: "completed",
					display_title:
						"Conductor [LLM-Orchestration/conductor] Issue #53 - Persona: coder - Event: schedule (recover_orphaned_in_progress)",
				},
				{
					status: "queued",
					display_title:
						"Conductor [LLM-Orchestration/conductor] Issue #53 - Persona: coder - Event: schedule (recover_orphaned_in_progress)",
				},
				{
					status: "completed",
					display_title:
						"Conductor [LLM-Orchestration/conductor] Issue #53 - Persona: coder - Event: repository_dispatch",
				},
				{
					status: "completed",
					display_title:
						"Conductor [LLM-Orchestration/conductor] Issue #99 - Persona: coder - Event: schedule (recover_orphaned_in_progress)",
				},
			]),
		).toBe(2);
	});

	it("defaults missing or unknown persona to conductor", () => {
		expect(normalizePersona("coder")).toBe("coder");
		expect(normalizePersona("conductor")).toBe("conductor");
		expect(normalizePersona(null)).toBe("conductor");
		expect(normalizePersona("reviewer")).toBe("conductor");
	});

	it("ignores project items whose content is not an issue", () => {
		expect(
			toProjectIssueItem(
				{
					status: { name: "In Progress" },
					persona: { name: null },
					content: {},
				},
				1,
				"https://github.com/orgs/LLM-Orchestration/projects/1",
			),
		).toBeNull();
	});

	it("maps valid project issue nodes into recoverable items", () => {
		expect(
			toProjectIssueItem(
				{
					status: { name: "In Progress" },
					persona: { name: "coder" },
					content: {
						id: "I_157",
						number: 157,
						repository: { nameWithOwner: "LLM-Orchestration/conductor" },
					},
				},
				1,
				"https://github.com/orgs/LLM-Orchestration/projects/1",
			),
		).toEqual({
			repository: "LLM-Orchestration/conductor",
			issueNumber: 157,
			issueNodeId: "I_157",
			projectNumber: 1,
			projectUrl: "https://github.com/orgs/LLM-Orchestration/projects/1",
			status: "In Progress",
			persona: "coder",
		});
	});
});
