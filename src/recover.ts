import { buildRecoveryPrompt, selectRecoveryCandidates, type ProjectIssueItem } from './utils/recovery';

const TARGET_REPO = 'LLM-Orchestration/conductor';
const PROJECT_OWNER = 'LLM-Orchestration';
const PROJECT_NUMBER = 1;

interface ProjectItemsPage {
  organization?: {
    projectV2?: {
      items: ProjectItemsConnection;
    };
  };
}

interface ProjectItemsConnection {
  nodes: Array<{
    statusField?: { name?: string | null } | null;
    content?: {
      number?: number;
      title?: string;
      url?: string;
      body?: string;
      labels?: { nodes?: Array<{ name?: string | null }> | null } | null;
      repository?: {
        nameWithOwner?: string | null;
      } | null;
    } | null;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string | null;
  };
}

function requireToken(): string {
  const token = process.env.CONDUCTOR_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('CONDUCTOR_TOKEN, GH_TOKEN, or GITHUB_TOKEN must be set');
  }
  return token;
}

async function githubGraphql<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'conductor-recovery-watchdog'
    },
    body: JSON.stringify({ query, variables })
  });

  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new Error(`GitHub GraphQL request failed: ${JSON.stringify(body.errors || body)}`);
  }

  return body.data as T;
}

async function dispatchRecovery(issueNumber: number, persona: 'conductor' | 'coder', body: string, projectNumber: number, projectUrl: string, token: string): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${TARGET_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'conductor-recovery-watchdog'
    },
    body: JSON.stringify({
      event_type: 'project_in_progress',
      client_payload: {
        issue_number: issueNumber,
        project_number: projectNumber,
        project_url: projectUrl,
        status: 'In Progress',
        persona,
        event_name: 'issue_comment',
        action: 'created',
        body
      }
    })
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`GitHub repository_dispatch failed for issue #${issueNumber}: ${response.status} ${responseBody}`);
  }
}

async function loadProjectItems(token: string): Promise<ProjectIssueItem[]> {
  const query = `query ProjectItems($owner: String!, $number: Int!, $after: String) {
    organization(login: $owner) {
      projectV2(number: $number) {
        items(first: 100, after: $after) {
          nodes {
            statusField: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
              }
            }
            content {
              ... on Issue {
                number
                title
                url
                body
                labels(first: 100) {
                  nodes {
                    name
                  }
                }
                repository {
                  nameWithOwner
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }`;

  const items: ProjectIssueItem[] = [];
  let after: string | null = null;

  do {
    const data: ProjectItemsPage = await githubGraphql<ProjectItemsPage>(query, { owner: PROJECT_OWNER, number: PROJECT_NUMBER, after }, token);
    const page: ProjectItemsConnection | undefined = data.organization?.projectV2?.items;
    if (!page) {
      throw new Error(`Could not load project ${PROJECT_OWNER}/${PROJECT_NUMBER}`);
    }

    for (const node of page.nodes) {
      const content = node.content;
      if (!content?.number || content.repository?.nameWithOwner !== TARGET_REPO) {
        continue;
      }

      const labels = Array.isArray(content.labels?.nodes)
        ? content.labels.nodes.flatMap((label: { name?: string | null }) => (label?.name ? [label.name] : []))
        : [];
      const personaLabel = labels.find((label: string) => label === 'persona: conductor' || label === 'persona: coder') || null;

      items.push({
        repository: content.repository.nameWithOwner,
        issueNumber: content.number,
        issueTitle: content.title || `Issue #${content.number}`,
        issueUrl: content.url || '',
        issueBody: content.body || '',
        labels,
        status: node.statusField?.name || null,
        persona: personaLabel === 'persona: coder' ? 'coder' : personaLabel === 'persona: conductor' ? 'conductor' : null,
        projectNumber: PROJECT_NUMBER,
        projectUrl: `https://github.com/orgs/${PROJECT_OWNER}/projects/${PROJECT_NUMBER}`
      });
    }

    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor || null : null;
  } while (after);

  return items;
}

async function main(): Promise<void> {
  const token = requireToken();
  const items = await loadProjectItems(token);
  const candidates = selectRecoveryCandidates(items);

  if (candidates.length === 0) {
    console.log('No stalled in-progress items found.');
    return;
  }

  for (const candidate of candidates) {
    console.log(`Dispatching recovery for issue #${candidate.issueNumber} as ${candidate.targetPersona}`);
    await dispatchRecovery(
      candidate.issueNumber,
      candidate.targetPersona,
      buildRecoveryPrompt(candidate),
      candidate.projectNumber,
      candidate.projectUrl,
      token
    );
  }

  console.log(`Recovery dispatched for ${candidates.length} item(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
