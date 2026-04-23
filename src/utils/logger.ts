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

const SessionStartDataSchema = z
	.object({
		branch: z.string(),
		labels: z.array(z.string()),
	})
	.catchall(JsonValueSchema);

const SessionEndDataSchema = z.discriminatedUnion("status", [
	z
		.object({
			status: z.literal("success"),
		})
		.catchall(JsonValueSchema),
	z
		.object({
			status: z.literal("failure"),
			exitCode: z.number().nullable().default(null),
			error: z.string().nullable().default(null),
		})
		.catchall(JsonValueSchema),
]);

const GeminiEventDataSchema = z
	.discriminatedUnion("type", [
		z.object({
			type: z.literal("init"),
			session_id: z.string(),
			model: z.string(),
			timestamp: z.string(),
			_isMessageBus: z.boolean().nullable().default(null),
		}),
		z.object({
			type: z.literal("message"),
			role: z.enum(["user", "assistant"]),
			content: z.string(),
			delta: z.boolean(),
			timestamp: z.string(),
			_isMessageBus: z.boolean().nullable().default(null),
		}),
		z.object({
			type: z.literal("tool_use"),
			tool_name: z.string(),
			tool_id: z.string(),
			parameters: JsonObjectSchema,
			timestamp: z.string(),
			_isMessageBus: z.boolean().nullable().default(null),
		}),
		z.object({
			type: z.literal("tool_result"),
			tool_id: z.string(),
			status: z.string(),
			output: z.string(),
			timestamp: z.string(),
			error: z.string().nullable().default(null),
			_isMessageBus: z.boolean().nullable().default(null),
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
				.nullable()
				.default(null),
			timestamp: z.string(),
			response: z.string().nullable().default(null),
			error: z.string().nullable().default(null),
			_isMessageBus: z.boolean().nullable().default(null),
		}),
		z.object({
			type: z.literal("tool-calls-update"),
			toolCalls: z.array(
				z.object({
					id: z.string().nullable().default(null),
					function: z
						.object({
							name: z.string(),
							arguments: z.string(),
						})
						.nullable()
						.default(null),
				}),
			),
			schedulerId: z.string(),
			_isMessageBus: z.boolean().nullable().default(null),
		}),
		z.object({
			type: z.literal("call"),
			method: z.string(),
			args: JsonObjectSchema,
			_isMessageBus: z.boolean().nullable().default(null),
		}),
		z.object({
			type: z.literal("context-update"),
			data: JsonObjectSchema,
			_isMessageBus: z.boolean().nullable().default(null),
		}),
	])
	.or(
		z
			.object({
				type: z.string(),
				_isMessageBus: z.boolean().nullable().default(null),
			})
			.catchall(JsonValueSchema),
	);

type BaseEvent = {
	v: number;
	ts: string;
	run_id: string | null;
	repo: string | null;
	issue: number | null;
	persona: string | null;
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
				data:
					| ({ status: "success" } & JsonObject)
					| ({
							status: "failure";
							exitCode: number | null;
							error: string | null;
					  } & JsonObject);
		  }
		| { event: "GEMINI_EVENT"; data: z.infer<typeof GeminiEventDataSchema> }
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
