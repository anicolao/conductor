<script lang="ts">
  import type { ConductorEvent } from '../types';

  let { events = [] }: { events: ConductorEvent[] } = $props();

  const terminalEvents = $derived(events.filter(e => e.event === 'STDOUT' || e.event === 'STDERR'));
  const otherEvents = $derived(events.filter(e => e.event !== 'STDOUT' && e.event !== 'STDERR'));

  function formatTimestamp(ts: string) {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch (e) {
      return ts;
    }
  }

  function getMessage(event: ConductorEvent): string {
    if (typeof event.data === 'string') return event.data;
    if (event.data && typeof event.data.msg === 'string') return event.data.msg;
    if (event.data && typeof event.data.line === 'string') return event.data.line;
    return JSON.stringify(event.data);
  }
</script>

<div class="timeline">
  <div class="terminal-window">
    <div class="terminal-header">
      <span class="terminal-title">LLM Log Output</span>
    </div>
    <div class="terminal-body">
      {#if terminalEvents.length === 0}
        <p class="empty-terminal">Waiting for terminal output...</p>
      {:else}
        {#each terminalEvents as event}
          <p class="terminal-line {event.event.toLowerCase()}">
            <span class="line-ts">[{formatTimestamp(event.ts)}]</span>
            <span class="line-content">{getMessage(event)}</span>
          </p>
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
        <div class="event-card">
          <div class="event-header">
            <span class="timestamp">{formatTimestamp(event.ts)}</span>
            <span class="event-type">{event.event}</span>
            {#if event.persona}
              <span class="persona">({event.persona})</span>
            {/if}
          </div>
          <div class="event-body">
            <pre>{JSON.stringify(event.data, null, 2)}</pre>
          </div>
        </div>
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
    margin: 0;
    font-size: 0.85rem;
    background: #eee;
    padding: 0.5rem;
    border-radius: 2px;
    overflow-x: auto;
  }
</style>
