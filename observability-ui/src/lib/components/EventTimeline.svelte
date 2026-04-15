<script lang="ts">
  import type { ConductorEvent } from '../types';

  let { events = [] }: { events: ConductorEvent[] } = $props();

  const terminalEvents = $derived(events.filter(e => e.event === 'STDOUT' || e.event === 'STDERR'));
  const otherEvents = $derived(events.filter(e => e.event !== 'STDOUT' && e.event !== 'STDERR'));

  let terminalBody: HTMLDivElement;

  $effect(() => {
    if (terminalEvents && terminalBody) {
      terminalBody.scrollTop = terminalBody.scrollHeight;
    }
  });

  function formatTimestamp(ts: string) {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch (e) {
      return ts;
    }
  }

  function getMessage(event: ConductorEvent): string {
    if (event.data && typeof event.data.text === 'string') return event.data.text;
    if (event.data && typeof event.data.message === 'string') return event.data.message;
    if (typeof event.data === 'string') return event.data;
    if (event.data && typeof event.data.msg === 'string') return event.data.msg;
    if (event.data && typeof event.data.line === 'string') return event.data.line;
    if (event.data && typeof event.data.task === 'string') return event.data.task;
    return JSON.stringify(event.data);
  }
</script>

<div class="timeline">
  <div class="terminal-window">
    <div class="terminal-header">
      <span class="terminal-title">LLM Log Output</span>
    </div>
    <div class="terminal-body" bind:this={terminalBody}>
      {#if terminalEvents.length === 0}
        <p class="empty-terminal">Waiting for terminal output...</p>
      {:else}
        {#each terminalEvents as event}
          {#each (getMessage(event).split('\n')) as line}
            <p class="terminal-line {event.event.toLowerCase()}">
              <span class="line-ts">[{formatTimestamp(event.ts)}]</span>
              <span class="line-content">{line}</span>
            </p>
          {/each}
        {/each}
      {/if}
    </div>
  </div>

  <div class="other-events">
    <h3>Event Log</h3>
    {#if otherEvents.length === 0}
      <p class="empty">No other events found.</p>
    {:else}
      {#each otherEvents as event}
        {#if event.event === 'session_start'}
          <div class="event-card session-start">
            <div class="event-header">
              <span class="icon">🚀</span>
              <span class="event-type">Session Started</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body">
              <p><strong>Branch:</strong> {event.data?.branch || 'N/A'}</p>
              {#if event.data?.labels}
                <p><strong>Labels:</strong> {Array.isArray(event.data.labels) ? event.data.labels.join(', ') : JSON.stringify(event.data.labels)}</p>
              {/if}
            </div>
          </div>
        {:else if event.event === 'session_end'}
          <div class="event-card session-end {event.data?.status}">
            <div class="event-header">
              <span class="icon">{event.data?.status === 'success' ? '✅' : '❌'}</span>
              <span class="event-type">Session Ended ({event.data?.status || 'unknown'})</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body">
              {#if event.data?.error}
                <p class="error-msg"><strong>Error:</strong> {event.data.error}</p>
              {/if}
              {#if event.data?.exitCode !== undefined}
                <p><strong>Exit Code:</strong> {event.data.exitCode}</p>
              {/if}
            </div>
          </div>
        {:else if event.event.startsWith('LOG_')}
          <div class="event-card log-card {event.event.toLowerCase()}">
            <div class="event-header">
              <span class="icon">
                {#if event.event === 'LOG_ERROR'}❌{:else if event.event === 'LOG_WARN'}⚠️{:else if event.event === 'LOG_DEBUG'}🔍{:else}ℹ️{/if}
              </span>
              <span class="event-type">{event.event.replace('LOG_', '')}</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body">
              <p>{getMessage(event)}</p>
              {#if Object.keys(event.data || {}).filter(k => k !== 'message').length > 0}
                <pre>{JSON.stringify(Object.fromEntries(Object.entries(event.data).filter(([k]) => k !== 'message')), null, 2)}</pre>
              {/if}
            </div>
          </div>
        {:else if event.event === 'TASK'}
          <div class="event-card task-card">
            <div class="event-header">
              <span class="icon">📋</span>
              <span class="event-type">TASK</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body task-content">
              {getMessage(event)}
            </div>
          </div>
        {:else}
          <div class="event-card">
            <div class="event-header">
              <span class="event-type">{event.event}</span>
              {#if event.persona}
                <span class="persona">({event.persona})</span>
              {/if}
              <span class="timestamp">{formatTimestamp(event.ts)}</span>
            </div>
            <div class="event-body">
              <pre>{JSON.stringify(event.data, null, 2)}</pre>
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1rem;
    font-family: sans-serif;
  }

  .terminal-window {
    background: #1e1e1e;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 60vh;
  }

  .terminal-header {
    background: #333;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #444;
  }

  .terminal-title {
    color: #ccc;
    font-size: 0.85rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 500;
  }

  .terminal-body {
    padding: 1rem;
    overflow-y: auto;
    flex-grow: 1;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .terminal-line {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .terminal-line.stdout {
    color: #d4d4d4;
  }

  .terminal-line.stderr {
    color: #f14c4c;
  }

  .line-ts {
    color: #666;
    margin-right: 0.5rem;
    user-select: none;
  }

  .empty-terminal {
    color: #666;
    font-style: italic;
  }

  .other-events h3 {
    margin-top: 0;
    color: #444;
    border-bottom: 2px solid #eee;
    padding-bottom: 0.5rem;
  }

  .empty {
    color: #666;
    font-style: italic;
  }

  .event-card {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 0.75rem;
    background: #f9f9f9;
    margin-bottom: 1rem;
  }

  .event-header {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.25rem;
  }

  .timestamp {
    font-size: 0.8rem;
    color: #888;
    margin-left: auto;
  }

  .event-type {
    font-weight: bold;
    text-transform: uppercase;
    color: #007bff;
  }

  .persona {
    font-size: 0.9rem;
    color: #555;
  }

  .event-body pre {
    margin: 0.5rem 0 0 0;
    font-size: 0.85rem;
    background: #eee;
    padding: 0.5rem;
    border-radius: 2px;
    overflow-x: auto;
  }

  .session-start {
    border-left: 4px solid #007bff;
  }
  .session-end.success {
    border-left: 4px solid #28a745;
  }
  .session-end.failure {
    border-left: 4px solid #dc3545;
  }
  .log-card.log_info { border-left: 4px solid #17a2b8; }
  .log-card.log_warn { border-left: 4px solid #ffc107; }
  .log-card.log_error { border-left: 4px solid #dc3545; }
  .log-card.log_debug { border-left: 4px solid #6c757d; }
  
  .task-card { 
    border-left: 4px solid #6f42c1;
    background: #f3e5f5;
  }
  
  .task-content {
    font-weight: bold;
    font-size: 1.1rem;
    margin-top: 0.5rem;
  }
  
  .error-msg {
    color: #dc3545;
  }
  
  .icon {
    font-size: 1.1rem;
  }
</style>
