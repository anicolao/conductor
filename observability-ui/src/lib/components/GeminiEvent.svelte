<script lang="ts">
  import { marked } from 'marked';
  import type { ConductorEvent, GeminiEventData } from '../types';
  import JsonTree from './JsonTree.svelte';

  let { event, toolNameMap = new Map() }: { event: ConductorEvent, toolNameMap?: Map<string, string> } = $props();
  const eventData = $derived(event.data as GeminiEventData);

  const isDebugType = $derived(
    eventData.type === 'init' ||
    eventData.type === 'tool-calls-update' ||
    eventData.type === 'call' ||
    eventData.type === 'context-update' ||
    eventData._isMessageBus
  );

  const markdownContent = $derived.by(() => {
    if (eventData.type === 'message' && eventData.content) {
      return marked.parse(eventData.content) as string;
    }
    if (eventData.type === 'result' && eventData.response) {
      return marked.parse(eventData.response) as string;
    }
    return '';
  });

  const getEventClass = (data: GeminiEventData) => {
    let base = `gemini-event ${data.type.replace(/_/g, '-')}`;
    if (data.type === 'message') {
      base += ` ${data.role}`;
    }
    if (data._isMessageBus) {
      base += ' is-message-bus';
    }
    return base;
  };

  function getToolName(data: any) {
    const name =
      data.tool_name ||
      data.name ||
      data.tool;
    
    if (name) return name;
    
    if (data.tool_id && toolNameMap.has(data.tool_id)) {
      return toolNameMap.get(data.tool_id);
    }

    return (
      data.status ||
      (data.data && data.data.status) ||
      'unknown'
    );
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
      {#if isDebugType}
        <span class="debug-badge">{eventData._isMessageBus ? '🚌 ' : ''}DEBUG</span>
      {/if}
    </div>
    <div class="event-body">
      <p><strong>Session ID:</strong> <code>{eventData.sessionId}</code></p>
      <p><strong>Model:</strong> <code>{eventData.model}</code></p>
    </div>
  {:else if eventData.type === 'message'}
    <div class="event-header">
      <span class="icon">{eventData.role === 'assistant' ? '✨' : '👤'}</span>
      <span class="event-type">{eventData.role}</span>
      {#if eventData._isMessageBus}
        <span class="debug-badge">🚌 DEBUG</span>
      {/if}
    </div>
    <div class="event-body markdown">
      {@html markdownContent}
    </div>
  {:else if eventData.type === 'tool_use'}
    <div class="event-header">
      <span class="icon">🛠️</span>
      <span class="event-type">Tool Use: {getToolName(eventData)}</span>
      {#if eventData.tool_id}
        <span class="tool-id">({eventData.tool_id})</span>
      {/if}
      {#if eventData._isMessageBus}
        <span class="debug-badge">🚌 DEBUG</span>
      {/if}
    </div>
    <div class="event-body">
      <pre><code>{JSON.stringify(getToolArgs(eventData), null, 2)}</code></pre>
    </div>
  {:else if eventData.type === 'tool_result'}
    <div class="event-header">
      <span class="icon">📤</span>
      <span class="event-type">TOOL RESULT: {getToolName(eventData)}
        {#if eventData.status || (eventData.data && eventData.data.status)}
          ({eventData.status || eventData.data.status})
        {/if}
      </span>
      {#if eventData.tool_id}
        <span class="tool-id">({eventData.tool_id})</span>
      {/if}
      {#if eventData._isMessageBus}
        <span class="debug-badge">🚌 DEBUG</span>
      {/if}
    </div>
    <div class="event-body">
      {#if eventData.status || eventData.output || (eventData.data && (eventData.data.status || eventData.data.output))}
        {@const status = eventData.status || (eventData.data && eventData.data.status)}
        {@const output = eventData.output || (eventData.data && eventData.data.output)}
        {#if status}
          <div class="tool-result-status {status}">
            <strong>Status:</strong> {status}
          </div>
        {/if}
        {#if output}
          <pre class="terminal-output"><code>{output}</code></pre>
        {/if}
      {:else}
        <pre><code>{typeof eventData.result === 'string'
            ? eventData.result
            : JSON.stringify(eventData.result || eventData.data || eventData, null, 2)}</code></pre>
      {/if}
    </div>
  {:else if eventData.type === 'tool-calls-update'}
    <div class="event-header">
      <span class="icon">📡</span>
      <span class="event-type">Tool Calls Update: {eventData.schedulerId}</span>
      {#if isDebugType}
        <span class="debug-badge">{eventData._isMessageBus ? '🚌 ' : ''}DEBUG</span>
      {/if}
    </div>
    <div class="event-body">
      {#if eventData.toolCalls && eventData.toolCalls.length > 0}
        <div class="active-tool-calls">
          {#each eventData.toolCalls as toolCall}
            <span class="tool-call-pill">
              <code>{toolCall.function?.name || toolCall.id}</code>
            </span>
          {/each}
        </div>
      {:else}
        <p class="no-tool-calls">No active tool calls</p>
      {/if}
    </div>
  {:else if eventData.type === 'call'}
    <div class="event-header">
      <span class="icon">📞</span>
      <span class="event-type">Call: {eventData.method || 'unknown'}</span>
      {#if isDebugType}
        <span class="debug-badge">{eventData._isMessageBus ? '🚌 ' : ''}DEBUG</span>
      {/if}
    </div>
    <div class="event-body">
      <pre><code>{JSON.stringify(eventData.args || eventData.params || eventData, null, 2)}</code></pre>
    </div>
  {:else if eventData.type === 'context-update'}
    <div class="event-header">
      <span class="icon">🧠</span>
      <span class="event-type">Context Update</span>
      {#if isDebugType}
        <span class="debug-badge">{eventData._isMessageBus ? '🚌 ' : ''}DEBUG</span>
      {/if}
    </div>
    <div class="event-body">
      <pre><code>{JSON.stringify(eventData.context || eventData.updates || eventData, null, 2)}</code></pre>
    </div>
  {:else if eventData.type === 'result'}
    <div class="event-header">
      <span class="icon">🏁</span>
      <span class="event-type">Gemini Result</span>
      {#if eventData._isMessageBus}
        <span class="debug-badge">🚌 DEBUG</span>
      {/if}
    </div>
    <div class="event-body markdown">
      {@html markdownContent}
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
      {#if eventData._isMessageBus}
        <span class="debug-badge">🚌 DEBUG</span>
      {/if}
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

  .is-message-bus {
    border-left-color: #fd7e14;
    background-color: #fffaf5;
    border-style: dashed;
    opacity: 0.9;
  }

  .active-tool-calls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .tool-call-pill {
    background: #e9ecef;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8rem;
    border: 1px solid #dee2e6;
  }

  .no-tool-calls {
    color: #6c757d;
    font-style: italic;
    font-size: 0.9rem;
    margin: 0 !important;
  }

  .event-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.25rem;
  }

  .debug-badge {
    font-size: 0.7rem;
    background: #6c757d;
    color: white;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 0.5rem;
    vertical-align: middle;
  }

  .is-message-bus .debug-badge {
    background: #fd7e14;
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

  .markdown :global(p) {
    margin: 0.5rem 0;
  }
  .markdown :global(p:first-child) {
    margin-top: 0;
  }
  .markdown :global(p:last-child) {
    margin-bottom: 0;
  }
  .markdown :global(ul), .markdown :global(ol) {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  .markdown :global(code) {
    background: #f0f0f0;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.9em;
  }
  .markdown :global(pre) {
    background: #f4f4f4;
    padding: 0.75rem;
    border-radius: 4px;
    overflow-x: auto;
    margin: 0.5rem 0;
  }
  .markdown :global(pre code) {
    background: transparent;
    padding: 0;
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
  .tool-calls-update {
    border-left-color: #17a2b8;
  }

  .tool-result-status {
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    display: inline-block;
  }

  .tool-result-status.success {
    background-color: #d4edda;
    color: #155724;
  }

  .tool-result-status.error {
    background-color: #f8d7da;
    color: #721c24;
  }

  .terminal-output {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 0.75rem;
    border-radius: 4px;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.85rem;
    overflow-x: auto;
    border-left: 4px solid #444;
    margin: 0.5rem 0 0 0;
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
