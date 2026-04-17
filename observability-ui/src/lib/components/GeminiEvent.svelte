<script lang="ts">
  import type { ConductorEvent, GeminiEventData } from '../types';
  import JsonTree from './JsonTree.svelte';

  let { event }: { event: ConductorEvent } = $props();
  const eventData = $derived(event.data as GeminiEventData);

  const getEventClass = (data: GeminiEventData) => {
    const base = `gemini-event ${data.type.replace(/_/g, '-')}`;
    if (data.type === 'message') {
      return `${base} ${data.role}`;
    }
    return base;
  };

  function getToolName(data: any) {
    return data.tool_name || data.name || data.tool || 'unknown';
  }

  function getToolArgs(data: any) {
    return data.parameters || data.args || {};
  }
</script>

<div class={getEventClass(eventData)}>
  {#if eventData.type === 'init'}
    <div class="event-header">
      <span class="icon">🤖</span>
      <span class="event-type">Gemini Initialized</span>
    </div>
    <div class="event-body">
      <p><strong>Session ID:</strong> <code>{eventData.sessionId}</code></p>
      <p><strong>Model:</strong> <code>{eventData.model}</code></p>
    </div>
  {:else if eventData.type === 'message'}
    <div class="event-header">
      <span class="icon">{eventData.role === 'assistant' ? '✨' : '👤'}</span>
      <span class="event-type">{eventData.role}</span>
    </div>
    <div class="event-body">
      <p>{eventData.content}</p>
    </div>
  {:else if eventData.type === 'tool_use'}
    <div class="event-header">
      <span class="icon">🛠️</span>
      <span class="event-type">Tool Use: {getToolName(eventData)}</span>
      {#if eventData.tool_id}
        <span class="tool-id">({eventData.tool_id})</span>
      {/if}
    </div>
    <div class="event-body">
      <pre><code>{JSON.stringify(getToolArgs(eventData), null, 2)}</code></pre>
    </div>
  {:else if eventData.type === 'tool_result'}
    <div class="event-header">
      <span class="icon">📤</span>
      <span class="event-type">Tool Result: {getToolName(eventData)}</span>
      {#if eventData.tool_id}
        <span class="tool-id">({eventData.tool_id})</span>
      {/if}
    </div>
    <div class="event-body">
      <pre><code>{typeof eventData.result === 'string' ? eventData.result : JSON.stringify(eventData.result, null, 2)}</code></pre>
    </div>
  {:else if eventData.type === 'result'}
    <div class="event-header">
      <span class="icon">🏁</span>
      <span class="event-type">Gemini Result</span>
    </div>
    <div class="event-body">
      <p>{eventData.response}</p>
      {#if eventData.stats}
        <div class="stats">
          {#if eventData.stats.tokens}
            <div class="stat">
              <span class="label">Tokens:</span>
              <span class="value"
                >{eventData.stats.tokens.total || 0} (P: {eventData.stats.tokens.prompt || 0}, C: {eventData.stats.tokens.completion ||
                  0})</span
              >
            </div>
          {/if}
          {#if eventData.stats.latency}
            <div class="stat">
              <span class="label">Latency:</span>
              <span class="value">{eventData.stats.latency}ms</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="event-header">
      <span class="icon">❓</span>
      <span class="event-type">Unknown Event: {eventData.type}</span>
    </div>
    <div class="event-body">
      <pre><code>{JSON.stringify(eventData, null, 2)}</code></pre>
    </div>
  {/if}

  <div class="raw-json-section">
    <JsonTree data={event} isRoot={true} label="Event JSON" />
  </div>
</div>

<style>
  .gemini-event {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 0.75rem;
    background: #fff;
    margin-bottom: 1rem;
    border-left: 4px solid #6c757d;
  }

  .event-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.25rem;
  }

  .event-type {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 0.85rem;
    color: #555;
  }

  .tool-id {
    font-family: monospace;
    font-size: 0.75rem;
    color: #888;
  }

  .icon {
    font-size: 1.1rem;
  }

  .event-body {
    font-size: 0.95rem;
  }

  .event-body p {
    margin: 0.25rem 0;
    white-space: pre-wrap;
  }

  pre {
    background: #f4f4f4;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    overflow-x: auto;
    margin: 0.5rem 0 0 0;
  }

  .init {
    border-left-color: #007bff;
  }
  .message.assistant {
    border-left-color: #17a2b8;
  }
  .message.user {
    border-left-color: #007bff;
  }
  .tool-use {
    border-left-color: #ffc107;
  }
  .tool-result {
    border-left-color: #28a745;
  }
  .result {
    border-left-color: #6f42c1;
  }
  .unknown {
    border-left-color: #dc3545;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #666;
  }

  .stat {
    display: flex;
    gap: 0.25rem;
  }

  .label {
    font-weight: bold;
  }

  .raw-json-section {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px dashed #eee;
  }
</style>
