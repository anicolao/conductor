<script lang="ts">
  import type { ConductorEvent } from '../types';

  let { events = [] }: { events: ConductorEvent[] } = $props();

  function formatTimestamp(ts: string) {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch (e) {
      return ts;
    }
  }
</script>

<div class="timeline">
  {#if events.length === 0}
    <p class="empty">No events found.</p>
  {:else}
    {#each events as event}
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

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    font-family: sans-serif;
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
