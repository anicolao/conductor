/**
 * Real Types for Conductor
 * This file replaces generic JsonValue/JsonObject with strict interfaces.
 */

// --- Tool Parameters ---

export interface ListDirectoryParameters {
	dir_path: string;
	ignore?: string[];
	file_filtering_options?: {
		respect_git_ignore?: boolean;
		respect_gemini_ignore?: boolean;
	};
}

export interface ReadFileParameters {
	file_path: string;
	start_line?: number;
	end_line?: number;
}

export interface GrepSearchParameters {
	pattern: string;
	dir_path?: string;
	include_pattern?: string;
	exclude_pattern?: string;
	case_sensitive?: boolean;
	fixed_strings?: boolean;
	before?: number;
	after?: number;
	context?: number;
	total_max_matches?: number;
	max_matches_per_file?: number;
	names_only?: boolean;
	no_ignore?: boolean;
}

export interface GlobParameters {
	pattern: string;
	dir_path?: string;
	respect_git_ignore?: boolean;
	respect_gemini_ignore?: boolean;
	case_sensitive?: boolean;
}

export interface ReplaceParameters {
	file_path: string;
	instruction: string;
	old_string: string;
	new_string: string;
	allow_multiple?: boolean;
}

export interface WriteFileParameters {
	file_path: string;
	content: string;
}

export interface WebFetchParameters {
	prompt: string;
}

export interface GoogleWebSearchParameters {
	query: string;
}

export interface RunShellCommandParameters {
	command: string;
	description?: string;
	dir_path?: string;
	is_background?: boolean;
	delay_ms?: number;
}

export interface ListBackgroundProcessesParameters {
	wait_for_previous?: boolean;
}

export interface ReadBackgroundOutputParameters {
	pid: number;
	lines?: number;
	delay_ms?: number;
	wait_for_previous?: boolean;
}

export interface SaveMemoryParameters {
	fact: string;
	scope?: "global" | "project";
}

export interface EnterPlanModeParameters {
	reason?: string;
}

export interface InvokeAgentParameters {
	agent_name: string;
	prompt: string;
	wait_for_previous?: boolean;
}

export interface ActivateSkillParameters {
	name: "skill-creator";
}

export type ToolParameters =
	| { tool_name: "list_directory"; parameters: ListDirectoryParameters }
	| { tool_name: "read_file"; parameters: ReadFileParameters }
	| { tool_name: "grep_search"; parameters: GrepSearchParameters }
	| { tool_name: "glob"; parameters: GlobParameters }
	| { tool_name: "replace"; parameters: ReplaceParameters }
	| { tool_name: "write_file"; parameters: WriteFileParameters }
	| { tool_name: "web_fetch"; parameters: WebFetchParameters }
	| { tool_name: "google_web_search"; parameters: GoogleWebSearchParameters }
	| { tool_name: "run_shell_command"; parameters: RunShellCommandParameters }
	| {
			tool_name: "list_background_processes";
			parameters: ListBackgroundProcessesParameters;
	  }
	| {
			tool_name: "read_background_output";
			parameters: ReadBackgroundOutputParameters;
	  }
	| { tool_name: "save_memory"; parameters: SaveMemoryParameters }
	| { tool_name: "enter_plan_mode"; parameters: EnterPlanModeParameters }
	| { tool_name: "invoke_agent"; parameters: InvokeAgentParameters }
	| { tool_name: "activate_skill"; parameters: ActivateSkillParameters }
	| { tool_name: string; parameters: Record<string, unknown> };

// --- Internal Event Data ---

export interface GeminiContextUpdateData {
	memories?: Array<{ scope: string; fact: string }>;
	branch?: string;
	labels?: string[];
	[key: string]: unknown; // Allow for other fields while encouraging the ones above
}

export interface GeminiCallArgs {
	prompt?: string;
	agent_name?: string;
	wait_for_previous?: boolean;
	method?: string;
	[key: string]: unknown;
}
