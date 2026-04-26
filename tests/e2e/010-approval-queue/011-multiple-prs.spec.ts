import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Multiple PRs Approval Detail", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Multiple PRs Approval Detail",
		"Verify that the approvals UI correctly handles multiple linked PRs by showing artifacts from all PRs and hiding the approve button.",
	);

	const issueNumber = 198;
	const pr1Number = 201;
	const pr2Number = 202;
	const owner = "LLM-Orchestration";
	const repo = "conductor";

	// Mock GitHub User API
	await page.route("https://api.github.com/user", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				login: "test-user",
				avatar_url: "https://github.com/test-user.png",
			}),
		});
	});

	// Mock GitHub Repo API
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ full_name: `${owner}/${repo}` }),
			});
		},
	);

	// Mock GitHub GraphQL API
	await page.route("https://api.github.com/graphql", async (route) => {
		const requestBody = route.request().postDataJSON();

		if (requestBody.query.includes("IssueDetails")) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						repository: {
							mergeCommitAllowed: true,
							squashMergeAllowed: true,
							rebaseMergeAllowed: true,
							issue: {
								id: "issue_node_id",
								title: "Test Issue with Multiple PRs",
								body: "Test Body",
								labels: { nodes: [{ name: "persona: coder" }] },
								projectItems: { nodes: [{ id: "item_1" }] },
								timelineItems: {
									nodes: [
										{
											source: {
												number: pr1Number,
												url: `https://github.com/${owner}/${repo}/pull/${pr1Number}`,
												state: "OPEN",
												baseRepository: {
													owner: { login: owner },
													name: repo,
												},
											},
										},
										{
											source: {
												number: pr2Number,
												url: `https://github.com/${owner}/${repo}/pull/${pr2Number}`,
												state: "OPEN",
												baseRepository: {
													owner: { login: owner },
													name: repo,
												},
											},
										},
									],
								},
							},
						},
					},
				}),
			});
		} else {
			await route.continue();
		}
	});

	// Mock PR files API for PR1
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/pulls/${pr1Number}/files`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify([
					{
						filename: "artifact-pr1.md",
						raw_url: `https://raw.githubusercontent.com/${owner}/${repo}/raw/test-sha/artifact-pr1.md`,
						contents_url: `https://api.github.com/repos/${owner}/${repo}/contents/artifact-pr1.md?ref=test-sha`,
					},
				]),
			});
		},
	);

	// Mock PR files API for PR2
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/pulls/${pr2Number}/files`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify([
					{
						filename: "artifact-pr2.md",
						raw_url: `https://raw.githubusercontent.com/${owner}/${repo}/raw/test-sha/artifact-pr2.md`,
						contents_url: `https://api.github.com/repos/${owner}/${repo}/contents/artifact-pr2.md?ref=test-sha`,
					},
				]),
			});
		},
	);

	// Mock raw file content for PR1
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/contents/artifact-pr1.md?ref=test-sha`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "text/plain",
				body: `# Artifact from PR1`,
			});
		},
	);

	// Mock raw file content for PR2
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/contents/artifact-pr2.md?ref=test-sha`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "text/plain",
				body: `# Artifact from PR2`,
			});
		},
	);

	// Set token and navigate to Detail Page
	await page.goto("/");
	await page.evaluate(() => {
		localStorage.setItem("github_access_token", "test_access_token");
	});

	await page.goto(`/approval/${owner}/${repo}/${issueNumber}`);

	await helper.step("approval_detail_loaded_multiple_prs", {
		description: "Approval detail page shows artifacts from multiple PRs and warning message",
		verifications: [
			{
				spec: "Warning message is visible",
				check: async () =>
					expect(
						page.getByText("Multiple pull requests are linked to this issue"),
					).toBeVisible(),
			},
			{
				spec: "Artifact from PR1 is visible",
				check: async () => expect(page.getByText("artifact-pr1.md")).toBeVisible(),
			},
			{
				spec: "Artifact from PR2 is visible",
				check: async () => expect(page.getByText("artifact-pr2.md")).toBeVisible(),
			},
			{
				spec: "Approve & Merge button is NOT visible",
				check: async () =>
					expect(
						page.getByRole("button", { name: "Approve & Merge" }),
					).not.toBeVisible(),
			},
			{
				spec: "Other action buttons are still visible",
				check: async () => {
					await expect(
						page.getByRole("button", { name: "Comment & Move to In Progress" }),
					).toBeVisible();
					await expect(
						page.getByRole("button", { name: "Back to TODO" }),
					).toBeVisible();
				},
			},
		],
	});

	// Expand markdown from PR1
	await page.click('text="artifact-pr1.md"');
	await helper.step("artifact_pr1_expanded", {
		description: "Artifact from PR1 can be expanded to view content",
		verifications: [
			{
				spec: "Rendered markdown content from PR1 is visible",
				check: async () =>
					expect(
						page.getByRole("heading", { name: "Artifact from PR1" }),
					).toBeVisible(),
			},
		],
	});

	// Expand markdown from PR2
	await page.click('text="artifact-pr2.md"');
	await helper.step("artifact_pr2_expanded", {
		description: "Artifact from PR2 can be expanded to view content",
		verifications: [
			{
				spec: "Rendered markdown content from PR2 is visible",
				check: async () =>
					expect(
						page.getByRole("heading", { name: "Artifact from PR2" }),
					).toBeVisible(),
			},
		],
	});

	helper.generateDocs();
});
