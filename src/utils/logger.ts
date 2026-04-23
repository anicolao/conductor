import { z } from "zod";
import type { JsonObject } from "./types";
import { JsonObjectSchema, JsonValueSchema } from "./types";

/**
 * Conductor Structured Logging
 *
 * This utility emits structured JSON events to stdout, which can be parsed
 * by the Conductor Observability UI to provide a rich timeline of actions.
 */

const BaseEventSchema = z.object({
	v: z.number(),
	ts: z.string(),
	run_id: z.string().nullable(),
	repo: z.string().nullable(),
	issue: z.number().nullable(),
	persona: z.string().nullable(),
});

const LogEventDataSchema = z
	.object({
		message: z.string(),
	})
	.catchall(JsonValueSchema);

const StdoutStderrDataSchema = z.object({
	text: z.string(),
});

const SessionStartDataSchema = z.object({
	branch: z.string(),
	labels: z.array(z.string()),
});

const SessionEndDataSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("success"),
	}),
	z.object({
		status: z.literal("failure"),
		exitCode: z.number(),
		error: z.string(),
	}),
]);

const GeminiBaseSchema = z.object({
	_isMessageBus: z.boolean().default(false),
});

const GeminiInitEventSchema = GeminiBaseSchema.extend({
	type: z.literal("init"),
	session_id: z.string(),
	model: z.string(),
	timestamp: z.string(),
});

const GeminiMessageEventSchema = GeminiBaseSchema.extend({
	type: z.literal("message"),
	role: z.enum(["user", "assistant"]),
	content: z.string(),
	delta: z.boolean(),
	timestamp: z.string(),
});

const GeminiToolUseEventSchema = GeminiBaseSchema.extend({
	type: z.literal("tool_use"),
	tool_name: z.string(),
	tool_id: z.string(),
	parameters: JsonObjectSchema,
	timestamp: z.string(),
});

const GeminiToolResultEventSchema = GeminiBaseSchema.extend({
	type: z.literal("tool_result"),
	tool_id: z.string(),
	output: z.string(),
	timestamp: z.string(),
}).and(
	z.discriminatedUnion("status", [
		z.object({ status: z.literal("success") }),
		z.object({ status: z.literal("error"), error: z.string() }),
	]),
);

const GeminiResultEventSchema = GeminiBaseSchema.extend({
	type: z.literal("result"),
	timestamp: z.string(),
}).and(
	z.discriminatedUnion("status", [
		z.object({
			status: z.literal("success"),
			stats: z.object({
				total_tokens: z.number(),
				input_tokens: z.number(),
				output_tokens: z.number(),
				duration_ms: z.number(),
			}),
			response: z.string(),
		}),
		z.object({
			status: z.literal("error"),
			error: z.string(),
		}),
	]),
);

const GeminiToolCallsUpdateEventSchema = GeminiBaseSchema.extend({
	type: z.literal("tool-calls-update"),
	toolCalls: z.array(
		z.object({
			id: z.string(),
			function: z.object({
				name: z.string(),
				arguments: z.string(),
			}),
		}),
	),
	schedulerId: z.string(),
});

const GeminiCallEventSchema = GeminiBaseSchema.extend({
	type: z.literal("call"),
	method: z.string(),
	args: JsonObjectSchema,
});

const GeminiContextUpdateEventSchema = GeminiBaseSchema.extend({
	type: z.literal("context-update"),
	data: JsonObjectSchema,
});

const GeminiEventDataSchema = z.union([
	GeminiInitEventSchema,
	GeminiMessageEventSchema,
	GeminiToolUseEventSchema,
	GeminiToolResultEventSchema,
	GeminiResultEventSchema,
	GeminiToolCallsUpdateEventSchema,
	GeminiCallEventSchema,
	GeminiContextUpdateEventSchema,
]);

type BaseEvent = {
	v: number;
	ts: string;
	run_id: string | null;
	repo: string | null;
	issue: number | null;
	persona: string | null;
};

export type GeminiEventData = z.infer<typeof GeminiEventDataSchema>;

export type ConductorEvent = BaseEvent &
	(
		| { event: "LOG_INFO"; data: { message: string } & JsonObject }
		| { event: "LOG_WARN"; data: { message: string } & JsonObject }
		| { event: "LOG_ERROR"; data: { message: string } & JsonObject }
		| { event: "LOG_DEBUG"; data: { message: string } & JsonObject }
		| { event: "STDOUT"; data: { text: string } }
		| { event: "STDERR"; data: { text: string } }
		| {
				event: "session_start";
				data: { branch: string; labels: string[] };
		  }
		| {
				event: "session_end";
				data:
					| { status: "success" }
					| {
							status: "failure";
							exitCode: number;
							error: string;
					  };
		  }
		| { event: "GEMINI_EVENT"; data: GeminiEventData }
		| { event: "TASK"; data: { message: string } }
		| { event: "LOG_DEBUG_GROUP"; data: { events: ConductorEvent[] } }
	);

export const ConductorEventSchema: z.ZodType<ConductorEvent> =
	z.discriminatedUnion("event", [
		BaseEventSchema.extend({
			event: z.literal("LOG_INFO"),
			data: LogEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("LOG_WARN"),
			data: LogEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("LOG_ERROR"),
			data: LogEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("LOG_DEBUG"),
			data: LogEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("STDOUT"),
			data: StdoutStderrDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("STDERR"),
			data: StdoutStderrDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("session_start"),
			data: SessionStartDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("session_end"),
			data: SessionEndDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("GEMINI_EVENT"),
			data: GeminiEventDataSchema,
		}),
		BaseEventSchema.extend({
			event: z.literal("TASK"),
			data: z.object({ message: z.string() }),
		}),
		BaseEventSchema.extend({
			event: z.literal("LOG_DEBUG_GROUP"),
			data: z.object({ events: z.array(z.lazy(() => ConductorEventSchema)) }),
		}),
	]);

/**
 * Logs a structured event to stdout.
 *
 * @param event The event type (e.g., 'session_start', 'session_end')
 * @param data  The event payload
 * @param context Optional context to override default values
 */
export function logEvent(
	event: ConductorEvent["event"],
	data: ConductorEvent["data"],
	context: { persona?: string | null; issue?: number | null } = {},
) {
	// Tighten data using schemas if applicable to ensure required fields are present (as null)
	let finalData = data;
	try {
		if (event === "GEMINI_EVENT") {
			finalData = GeminiEventDataSchema.parse(data);
		} else if (event === "session_end") {
			finalData = SessionEndDataSchema.parse(data);
		}
	} catch (e) {
		// Fallback to original data if parsing fails (shouldn't happen with correct types)
		console.error(`Failed to tighten data for event ${event}:`, e);
	}

	const payload = {
		v: 1,
		ts: new Date().toISOString(),
		run_id: process.env.GITHUB_RUN_ID || null,
		repo: process.env.GITHUB_REPOSITORY || null,
		issue:
			context.issue ||
			(process.env.CONDUCTOR_ISSUE
				? parseInt(process.env.CONDUCTOR_ISSUE, 10)
				: null),
		persona: context.persona || process.env.CONDUCTOR_PERSONA || null,
		event,
		data: finalData,
	} as ConductorEvent;

	process.stdout.write(`::CONDUCTOR_EVENT::${JSON.stringify(payload)}\n`);
}

export const logger = {
	info: (
		message: string,
		data?: JsonObject,
		context?: { persona?: string | null; issue?: number | null },
	) => logEvent("LOG_INFO", { message, ...data }, context),

	warn: (
		message: string,
		data?: JsonObject,
		context?: { persona?: string | null; issue?: number | null },
	) => logEvent("LOG_WARN", { message, ...data }, context),

	error: (
		message: string,
		data?: JsonObject,
		context?: { persona?: string | null; issue?: number | null },
	) => logEvent("LOG_ERROR", { message, ...data }, context),

	debug: (
		message: string,
		data?: JsonObject,
		context?: { persona?: string | null; issue?: number | null },
	) => logEvent("LOG_DEBUG", { message, ...data }, context),

	stdout: (
		text: string,
		context?: { persona?: string | null; issue?: number | null },
	) => logEvent("STDOUT", { text }, context),

	stderr: (
		text: string,
		context?: { persona?: string | null; issue?: number | null },
	) => logEvent("STDERR", { text }, context),
};
