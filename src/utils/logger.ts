import { z } from 'zod';
import type { JsonObject } from './types';
import { JsonObjectSchema, JsonValueSchema } from './types';

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

const LogEventDataSchema = z.object({
  message: z.string(),
}).catchall(JsonValueSchema);

const StdoutStderrDataSchema = z.object({
  text: z.string(),
});

const SessionStartDataSchema = z.object({
  branch: z.string(),
  labels: z.array(z.string()),
}).catchall(JsonValueSchema);

const SessionEndDataSchema = z.object({
  status: z.enum(['success', 'failure']),
  exitCode: z.number().optional(),
  error: z.string().optional(),
}).catchall(JsonValueSchema);

const GeminiEventDataSchema = z.object({
  type: z.string(),
}).catchall(JsonValueSchema);

export const ConductorEventSchema = z.discriminatedUnion('event', [
  BaseEventSchema.extend({ event: z.literal('LOG_INFO'), data: LogEventDataSchema }),
  BaseEventSchema.extend({ event: z.literal('LOG_WARN'), data: LogEventDataSchema }),
  BaseEventSchema.extend({ event: z.literal('LOG_ERROR'), data: LogEventDataSchema }),
  BaseEventSchema.extend({ event: z.literal('LOG_DEBUG'), data: LogEventDataSchema }),
  BaseEventSchema.extend({ event: z.literal('STDOUT'), data: StdoutStderrDataSchema }),
  BaseEventSchema.extend({ event: z.literal('STDERR'), data: StdoutStderrDataSchema }),
  BaseEventSchema.extend({ event: z.literal('session_start'), data: SessionStartDataSchema }),
  BaseEventSchema.extend({ event: z.literal('session_end'), data: SessionEndDataSchema }),
  BaseEventSchema.extend({ event: z.literal('GEMINI_EVENT'), data: GeminiEventDataSchema }),
  BaseEventSchema.extend({ event: z.literal('TASK'), data: z.object({ message: z.string() }).catchall(JsonValueSchema) }),
  BaseEventSchema.extend({ event: z.literal('LOG_DEBUG_GROUP'), data: z.object({ events: z.array(z.any()) }) }),
]);

export type ConductorEvent = z.infer<typeof ConductorEventSchema>;

/**
 * Logs a structured event to stdout.
 * 
 * @param event The event type (e.g., 'session_start', 'session_end')
 * @param data  The event payload
 * @param context Optional context to override default values
 */
export function logEvent(
  event: ConductorEvent['event'], 
  data: ConductorEvent['data'], 
  context: { persona?: string; issue?: number } = {}
) {
  const payload = {
    v: 1,
    ts: new Date().toISOString(),
    run_id: process.env.GITHUB_RUN_ID,
    repo: process.env.GITHUB_REPOSITORY,
    issue: context.issue || (process.env.CONDUCTOR_ISSUE ? parseInt(process.env.CONDUCTOR_ISSUE, 10) : undefined),
    persona: context.persona || process.env.CONDUCTOR_PERSONA,
    event,
    data
  } as ConductorEvent;

  process.stdout.write(`::CONDUCTOR_EVENT::${JSON.stringify(payload)}\n`);
}

export const logger = {
  info: (message: string, data?: JsonObject, context?: { persona?: string; issue?: number }) => 
    logEvent('LOG_INFO', { message, ...data }, context),
  
  warn: (message: string, data?: JsonObject, context?: { persona?: string; issue?: number }) => 
    logEvent('LOG_WARN', { message, ...data }, context),
  
  error: (message: string, data?: JsonObject, context?: { persona?: string; issue?: number }) => 
    logEvent('LOG_ERROR', { message, ...data }, context),
  
  debug: (message: string, data?: JsonObject, context?: { persona?: string; issue?: number }) => 
    logEvent('LOG_DEBUG', { message, ...data }, context),
  
  stdout: (text: string, context?: { persona?: string; issue?: number }) => 
    logEvent('STDOUT', { text }, context),
  
  stderr: (text: string, context?: { persona?: string; issue?: number }) => 
    logEvent('STDERR', { text }, context),
};
