/**
 * Conductor Structured Logging
 * 
 * This utility emits structured JSON events to stdout, which can be parsed
 * by the Conductor Observability UI to provide a rich timeline of actions.
 */

export interface ConductorEvent {
  v: number;
  ts: string;
  run_id?: string;
  repo?: string;
  issue?: number;
  persona?: string;
  event: string;
  data: any;
}

/**
 * Logs a structured event to stdout.
 * 
 * @param event The event type (e.g., 'session_start', 'session_end')
 * @param data  The event payload
 * @param context Optional context to override default values
 */
export function logEvent(
  event: string, 
  data: any, 
  context: { persona?: string; issue?: number } = {}
) {
  const payload: ConductorEvent = {
    v: 1,
    ts: new Date().toISOString(),
    run_id: process.env.GITHUB_RUN_ID,
    repo: process.env.GITHUB_REPOSITORY,
    issue: context.issue || (process.env.CONDUCTOR_ISSUE ? parseInt(process.env.CONDUCTOR_ISSUE, 10) : undefined),
    persona: context.persona || process.env.CONDUCTOR_PERSONA,
    event,
    data
  };

  process.stdout.write(`::CONDUCTOR_EVENT::${JSON.stringify(payload)}\n`);
}

export const logger = {
  info: (message: string, data?: any, context?: { persona?: string; issue?: number }) => 
    logEvent('LOG_INFO', { message, ...data }, context),
  
  warn: (message: string, data?: any, context?: { persona?: string; issue?: number }) => 
    logEvent('LOG_WARN', { message, ...data }, context),
  
  error: (message: string, data?: any, context?: { persona?: string; issue?: number }) => 
    logEvent('LOG_ERROR', { message, ...data }, context),
  
  debug: (message: string, data?: any, context?: { persona?: string; issue?: number }) => 
    logEvent('LOG_DEBUG', { message, ...data }, context),
  
  stdout: (text: string, context?: { persona?: string; issue?: number }) => 
    logEvent('STDOUT', { text }, context),
  
  stderr: (text: string, context?: { persona?: string; issue?: number }) => 
    logEvent('STDERR', { text }, context),
};
