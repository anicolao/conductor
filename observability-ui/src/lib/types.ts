import type { ConductorEvent } from '../../../src/utils/logger';

export type { ConductorEvent };

export interface GeminiInitEvent {
	type: 'init';
	sessionId: string;
	model: string;
}

export interface GeminiMessageEvent {
	type: 'message';
	role: 'user' | 'assistant';
	content: string;
}

export interface GeminiToolUseEvent {
	type: 'tool_use';
	tool?: string;
	name?: string;
	tool_name?: string;
	tool_id?: string;
	args?: Record<string, any>;
	parameters?: Record<string, any>;
}

export interface GeminiToolResultEvent {
	type: 'tool_result';
	tool?: string;
	name?: string;
	tool_name?: string;
	tool_id?: string;
	result?: any;
	status?: string;
	output?: string;
	data?: {
		status?: string;
		output?: string;
		[key: string]: any;
	};
}

export interface GeminiUnknownEvent {
	type: string;
	[key: string]: any;
}

export interface GeminiResultEvent {
	type: 'result';
	response: string;
	stats: {
		tokens?: {
			prompt?: number;
			completion?: number;
			total?: number;
		};
		latency?: number;
	};
}

export interface GeminiToolCallsUpdateEvent {
	type: 'tool-calls-update';
	toolCalls: any[];
	schedulerId: string;
}

export type GeminiEventData =
	| GeminiInitEvent
	| GeminiMessageEvent
	| GeminiToolUseEvent
	| GeminiToolResultEvent
	| GeminiResultEvent
	| GeminiToolCallsUpdateEvent
	| GeminiUnknownEvent;

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
