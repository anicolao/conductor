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
	run_id: z.string().optional(),
	repo: z.string().optional(),
	issue: z.number().optional(),
	persona: z.string().optional(),
});

const LogEventDataSchema = z
	.object({
		message: z.string(),
	})
	.catchall(JsonValueSchema);

const StdoutStderrDataSchema = z.object({
	text: z.string(),
});

const SessionStartDataSchema = z
	.object({
		branch: z.string(),
		labels: z.array(z.string()),
	})
	.catchall(JsonValueSchema);

const SessionEndDataSchema = z
	.object({
		status: z.enum(["success", "failure"]),
		exitCode: z.number().optional(),
		error: z.string().optional(),
	})
	.catchall(JsonValueSchema);

const GeminiEventDataSchema = z
	.discriminatedUnion("type", [
		z.object({
			type: z.literal("init"),
			session_id: z.string(),
			model: z.string(),
			timestamp: z.string(),
			_isMessageBus: z.boolean().optional(),
		}),
		z.object({
			type: z.literal("message"),
			role: z.enum(["user", "assistant"]),
			content: z.string(),
			delta: z.boolean(),
			timestamp: z.string(),
			_isMessageBus: z.boolean().optional(),
		}),
		z.object({
			type: z.literal("tool_use"),
			tool_name: z.string(),
			tool_id: z.string(),
			parameters: JsonObjectSchema,
			timestamp: z.string(),
			_isMessageBus: z.boolean().optional(),
		}),
		z.object({
			type: z.literal("tool_result"),
			tool_id: z.string(),
			status: z.string(),
			output: z.string(),
			timestamp: z.string(),
			error: z.string().optional(),
			_isMessageBus: z.boolean().optional(),
		}),
		z.object({
			type: z.literal("result"),
			status: z.string(),
			stats: z
				.object({
					total_tokens: z.number(),
					input_tokens: z.number(),
					output_tokens: z.number(),
					duration_ms: z.number(),
				})
				.optional(),
			timestamp: z.string(),
			response: z.string().optional(),
			error: z.string().optional(),
			_isMessageBus: z.boolean().optional(),
		}),
		z.object({
			type: z.literal("tool-calls-update"),
			toolCalls: z.array(
				z.object({
					id: z.string().optional(),
					function: z
						.object({
							name: z.string(),
							arguments: z.string(),
						})
						.optional(),
				}),
			),
			schedulerId: z.string(),
			_isMessageBus: z.boolean().optional(),
		}),
		z.object({
			type: z.literal("call"),
			method: z.string(),
			args: JsonObjectSchema,
			_isMessageBus: z.boolean().optional(),
		}),
		z.object({
			type: z.literal("context-update"),
			data: JsonObjectSchema,
			_isMessageBus: z.boolean().optional(),
		}),
	])
	.or(
		z
			.object({
				type: z.string(),
				_isMessageBus: z.boolean().optional(),
			})
			.catchall(JsonValueSchema),
	);

type BaseEvent = {
	v: number;
	ts: string;
	run_id?: string;
	repo?: string;
	issue?: number;
	persona?: string;
};

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
				data: { branch: string; labels: string[] } & JsonObject;
		  }
		| {
				event: "session_end";
				data: {
					status: "success" | "failure";
					exitCode?: number;
					error?: string;
				} & JsonObject;
		  }
		| { event: "GEMINI_EVENT"; data: { type: string } & JsonObject }
		| { event: "TASK"; data: { message: string } & JsonObject }
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
			data: z.object({ message: z.string() }).catchall(JsonValueSchema),
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
	context: { persona?: string; issue?: number } = {},
) {
	const payload = {
		v: 1,
		ts: new Date().toISOString(),
		run_id: process.env.GITHUB_RUN_ID,
		repo: process.env.GITHUB_REPOSITORY,
		issue:
			context.issue ||
			(process.env.CONDUCTOR_ISSUE
				? parseInt(process.env.CONDUCTOR_ISSUE, 10)
				: undefined),
		persona: context.persona || process.env.CONDUCTOR_PERSONA,
		event,
		data,
	} as ConductorEvent;

	process.stdout.write(`::CONDUCTOR_EVENT::${JSON.stringify(payload)}\n`);
}

export const logger = {
	info: (
		message: string,
		data?: JsonObject,
		context?: { persona?: string; issue?: number },
	) => logEvent("LOG_INFO", { message, ...data }, context),

	warn: (
		message: string,
		data?: JsonObject,
		context?: { persona?: string; issue?: number },
	) => logEvent("LOG_WARN", { message, ...data }, context),

	error: (
		message: string,
		data?: JsonObject,
		context?: { persona?: string; issue?: number },
	) => logEvent("LOG_ERROR", { message, ...data }, context),

	debug: (
		message: string,
		data?: JsonObject,
		context?: { persona?: string; issue?: number },
	) => logEvent("LOG_DEBUG", { message, ...data }, context),

	stdout: (text: string, context?: { persona?: string; issue?: number }) =>
		logEvent("STDOUT", { text }, context),

	stderr: (text: string, context?: { persona?: string; issue?: number }) =>
		logEvent("STDERR", { text }, context),
};
