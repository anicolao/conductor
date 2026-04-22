import type { ConductorEvent } from '../../../src/utils/logger';

export type { ConductorEvent };

/**
 * Represents a valid JSON value.
 */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| { [key: string]: JsonValue }
	| JsonValue[];

/**
 * Represents a valid JSON object.
 */
export type JsonObject = { [key: string]: JsonValue };

export interface GeminiInitEvent {
	type: 'init';
	session_id: string;
	model: string;
	timestamp: string;
}

export interface GeminiMessageEvent {
	type: 'message';
	role: 'user' | 'assistant';
	content: string;
	delta: boolean;
	timestamp: string;
}

export interface GeminiToolUseEvent {
	type: 'tool_use';
	tool_name: string;
	tool_id: string;
	parameters: JsonObject;
	timestamp: string;
}

export interface GeminiToolResultEvent {
	type: 'tool_result';
	tool_id: string;
	status: string;
	output: string;
	timestamp: string;
	error?: string;
}

export interface GeminiResultEvent {
	type: 'result';
	status: string;
	stats?: {
		total_tokens: number;
		input_tokens: number;
		output_tokens: number;
		duration_ms: number;
	};
	timestamp: string;
	response?: string;
	error?: string;
}

export interface GeminiToolCallsUpdateEvent {
	type: 'tool-calls-update';
	toolCalls: Array<{
		id?: string;
		function?: {
			name: string;
			arguments: string;
		};
	}>;
	schedulerId: string;
}

export interface GeminiCallEvent {
	type: 'call';
	method: string;
	args: JsonObject;
}

export interface GeminiContextUpdateEvent {
	type: 'context-update';
	data: JsonObject;
}

export interface GeminiUnknownEvent {
	type: string;
	[key: string]: JsonValue;
}

export interface MessageBusMixin {
	_isMessageBus?: boolean;
}

export type GeminiEventData = (
	| GeminiInitEvent
	| GeminiMessageEvent
	| GeminiToolUseEvent
	| GeminiToolResultEvent
	| GeminiResultEvent
	| GeminiToolCallsUpdateEvent
	| GeminiCallEvent
	| GeminiContextUpdateEvent
	| GeminiUnknownEvent
) & MessageBusMixin;

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
