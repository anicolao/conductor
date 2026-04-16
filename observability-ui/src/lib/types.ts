import type { ConductorEvent } from '../../../src/utils/logger';

export type { ConductorEvent };

export interface WorkflowRun {
	id: number;
	name: string;
	display_title: string;
	status: string;
	conclusion: string | null;
	html_url: string;
	created_at: string;
	updated_at: string;
	head_branch: string;
	head_sha: string;
	pull_requests: {
		number: number;
		html_url: string;
	}[];
}

export interface WorkflowRunsResponse {
	total_count: number;
	workflow_runs: WorkflowRun[];
}

export interface Issue {
	number: number;
	title: string;
	html_url: string;
	labels: { name: string }[];
	pull_request?: {
		html_url: string;
	};
}

export interface WorkflowStep {
	name: string;
	status: string;
	conclusion: string | null;
	number: number;
	started_at: string;
	completed_at: string | null;
}

export interface WorkflowJob {
	id: number;
	run_id: number;
	name: string;
	status: string;
	conclusion: string | null;
	started_at: string;
	completed_at: string | null;
	steps: WorkflowStep[];
	html_url: string;
}
