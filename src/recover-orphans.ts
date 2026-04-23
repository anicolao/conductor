import dotenv from "dotenv";
import { z } from "zod";
import { logger } from "./utils/logger";
import {
	type ConductorWorkflowRun,
	ConductorWorkflowRunSchema,
	countRecoveryAttempts,
	findOrphanedItems,
	normalizePersona,
	type ProjectIssueItem,
	type ProjectItemNode,
	toProjectIssueItem,
} from "./utils/recover";

const ORG_LOGIN = process.env.CONDUCTOR_PROJECT_OWNER || "LLM-Orchestration";
const PROJECT_NUMBER = Number(process.env.CONDUCTOR_PROJECT_NUMBER || "1");
const TARGET_REPO = process.env.CONDUCTOR_REPO || "LLM-Orchestration/conductor";
const WORKFLOW_FILE = process.env.CONDUCTOR_WORKFLOW_FILE || "conductor.yml";
const DEFAULT_MAX_RETRIES = Number(
	process.env.CONDUCTOR_RECOVERY_MAX_RETRIES || "5",
);

interface RecoverOptions {
	dryRun: boolean;
	maxRetries: number;
}

const WorkflowRunsResponseSchema = z
	.object({
		workflow_runs: z.array(ConductorWorkflowRunSchema),
	})
	.passthrough();

const ProjectItemsQuerySchema = z
	.object({
		organization: z.object({
			projectV2: z.object({
				url: z.string(),
				items: z.object({
					pageInfo: z.object({
						hasNextPage: z.boolean(),
						endCursor: z.string().nullable(),
					}),
					nodes: z.array(
						z.object({
							status: z
								.object({
									name: z.string().nullable(),
								})
								.nullable(),
							persona: z
								.object({
									name: z.string().nullable(),
								})
								.nullable(),
							content: z
								.object({
									id: z.string().nullable().optional(),
									number: z.number().nullable().optional(),
									repository: z
										.object({
											nameWithOwner: z.string().nullable().optional(),
										})
										.nullable()
										.optional(),
								})
								.passthrough()
								.nullable(),
						}),
					),
				}),
			}),
		}),
	})
	.passthrough();
const GraphqlResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z
		.object({
			data: dataSchema.optional(),
			errors: z.array(z.object({ message: z.string() })).optional(),
		})
		.passthrough();

type ProjectItemsQuery = z.infer<typeof ProjectItemsQuerySchema>;

function getToken(): string {
	const token =
		process.env.CONDUCTOR_TOKEN ||
		process.env.GH_TOKEN ||
		process.env.GITHUB_TOKEN;
	if (!token) {
		throw new Error("CONDUCTOR_TOKEN, GH_TOKEN, or GITHUB_TOKEN must be set");
	}
	return token;
}

function parseArgs(argv: string[]): RecoverOptions {
	let dryRun = false;
	let maxRetries = DEFAULT_MAX_RETRIES;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];

		if (arg === "--dry-run") {
			dryRun = true;
			continue;
		}

		if (arg === "--max-retries") {
			const value = argv[i + 1];
			if (!value) {
				throw new Error("--max-retries requires a numeric value");
			}
			maxRetries = Number(value);
			i += 1;
			continue;
		}

		if (arg.startsWith("--max-retries=")) {
			maxRetries = Number(arg.split("=")[1]);
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	if (!Number.isInteger(maxRetries) || maxRetries < 0) {
		throw new Error(
			`--max-retries must be a non-negative integer, got: ${maxRetries}`,
		);
	}

	return { dryRun, maxRetries };
}

async function githubGraphql<T>(
	schema: z.ZodType<T>,
	query: string,
	variables: Record<string, unknown>,
	token: string,
): Promise<T> {
	const response = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"Content-Type": "application/json",
			"User-Agent": "conductor-orphan-recovery",
		},
		body: JSON.stringify({ query, variables }),
	});

	const json = await response.json();
	const body = GraphqlResponseSchema(schema).parse(json);

	if (!response.ok || body.errors?.length) {
		throw new Error(
			`GitHub GraphQL request failed: ${JSON.stringify(body.errors || body)}`,
		);
	}

	if (!body.data) {
		throw new Error("GitHub GraphQL request returned no data");
	}

	return body.data;
}

async function githubRest<T>(
	schema: z.ZodType<T>,
	path: string,
	token: string,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"Content-Type": "application/json",
			"User-Agent": "conductor-orphan-recovery",
			...(init?.headers || {}),
		},
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`GitHub REST request failed for ${path}: ${response.status} ${text}`,
		);
	}

	const text = await response.text();
	if (!text.trim()) {
		return undefined as unknown as T;
	}

	const json = JSON.parse(text);
	return schema.parse(json);
}

async function loadProjectItems(token: string): Promise<ProjectIssueItem[]> {
	const query = `
    query ProjectItems($org: String!, $number: Int!, $after: String) {
      organization(login: $org) {
        projectV2(number: $number) {
          url
          items(first: 100, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
              persona: fieldValueByName(name: "Persona") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
              content {
                ... on Issue {
                  id
                  number
                  repository {
                    nameWithOwner
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

	const items: ProjectIssueItem[] = [];
	let after: string | null = null;

	while (true) {
		const data: ProjectItemsQuery = await githubGraphql(
			ProjectItemsQuerySchema,
			query,
			{ org: ORG_LOGIN, number: PROJECT_NUMBER, after },
			token,
		);
		const project = data.organization?.projectV2;
		if (!project) {
			throw new Error(`Project ${ORG_LOGIN}#${PROJECT_NUMBER} was not found`);
		}

		for (const node of project.items.nodes as ProjectItemNode[]) {
			const item = toProjectIssueItem(node, PROJECT_NUMBER, project.url);
			if (item) {
				items.push(item);
			}
		}

		if (!project.items.pageInfo.hasNextPage) {
			break;
		}
		after = project.items.pageInfo.endCursor;
	}

	return items;
}

async function loadWorkflowRuns(
	token: string,
): Promise<ConductorWorkflowRun[]> {
	const data = await githubRest(
		WorkflowRunsResponseSchema,
		`/repos/${TARGET_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=100`,
		token,
	);
	return data.workflow_runs;
}

async function dispatchRecovery(
	item: ProjectIssueItem,
	token: string,
): Promise<void> {
	await githubRest(z.unknown(), `/repos/${TARGET_REPO}/dispatches`, token, {
		method: "POST",
		body: JSON.stringify({
			event_type: "project_in_progress",
			client_payload: {
				repository: item.repository,
				issue_number: item.issueNumber,
				issue_node_id: item.issueNodeId,
				project_number: item.projectNumber,
				project_url: item.projectUrl,
				persona: normalizePersona(item.persona),
				event_name: "schedule",
				action: "recover_orphaned_in_progress",
			},
		}),
	});
}

async function main(): Promise<void> {
	dotenv.config();
	const options = parseArgs(process.argv.slice(2));

	const token = getToken();
	const [items, runs] = await Promise.all([
		loadProjectItems(token),
		loadWorkflowRuns(token),
	]);

	const orphanedItems = findOrphanedItems(items, runs);
	logger.info(
		`Scanned ${items.length} project items; found ${orphanedItems.length} orphaned in-progress items ` +
			`(dryRun=${options.dryRun}, maxRetries=${options.maxRetries}).`,
	);

	for (const item of orphanedItems) {
		const retries = countRecoveryAttempts(item, runs);
		if (retries >= options.maxRetries) {
			logger.info(
				`Skipping ${item.repository}#${item.issueNumber}: recovery attempts exhausted ` +
					`(${retries}/${options.maxRetries}).`,
			);
			continue;
		}

		const persona = normalizePersona(item.persona);
		if (options.dryRun) {
			logger.info(
				`[dry-run] Would re-dispatch ${item.repository}#${item.issueNumber} as ${persona} ` +
					`(retry ${retries + 1}/${options.maxRetries}).`,
			);
			continue;
		}

		logger.info(
			`Re-dispatching ${item.repository}#${item.issueNumber} as ${persona} (retry ${retries + 1}/${options.maxRetries}).`,
		);
		await dispatchRecovery(item, token);
	}
}

main().catch((error) => {
	logger.error("Fatal error", {
		error: error instanceof Error ? error.message : String(error),
	});
	process.exit(1);
});
