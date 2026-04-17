<script lang="ts">
  import JsonTree from './JsonTree.svelte';

  let { data, label = 'Raw Data', depth = 0, isRoot = false } = $props();
  let expanded = $state(false);

  const isObject = (v: any) => v !== null && typeof v === 'object';
  const toggle = () => (expanded = !expanded);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };
</script>

<div class="json-tree" class:root={isRoot}>
  {#if isObject(data)}
    <div class="folder">
      <div class="folder-header">
        <div class="header-left">
          <button onclick={toggle} class="toggle-btn" aria-expanded={expanded}>
            <span class="arrow">{expanded ? '▼' : '▶'}</span>
            <span class="label">{label}</span>
            {#if !expanded}
              <span class="summary"
                >{Array.isArray(data) ? `[${data.length}]` : `{${Object.keys(data).length}}`}</span
              >
            {/if}
          </button>
          <button class="copy-btn" onclick={copyToClipboard} title="Copy to clipboard">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </div>
      {#if expanded}
        <div class="children" style="padding-left: 1rem; border-left: 1px solid #eee;">
          {#each Object.entries(data) as [key, value]}
            <JsonTree data={value} label={key} depth={depth + 1} />
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="leaf">
      <div class="header-left">
        <span class="label">{label}:</span>
        <span class="value">{JSON.stringify(data)}</span>
        <button class="copy-btn inline" onclick={copyToClipboard} title="Copy to clipboard">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .json-tree {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.8rem;
    text-align: left;
  }
  .folder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }
  .toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    color: #555;
    text-align: left;
  }
  .toggle-btn:hover {
    background: #f0f0f0;
  }
  .copy-btn {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: #888;
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .folder-header:hover .copy-btn,
  .leaf:hover .copy-btn {
    opacity: 1;
  }
  .copy-btn:hover {
    color: #333;
  }
  .copy-btn.inline {
    margin-left: 4px;
  }
  .arrow {
    font-size: 0.7rem;
    width: 12px;
    display: inline-block;
  }
  .label {
    font-weight: bold;
    color: #333;
  }
  .value {
    color: #007bff;
    word-break: break-all;
  }
  .summary {
    color: #888;
    font-style: italic;
    margin-left: 4px;
  }
  .root {
    margin-top: 10px;
    border-top: 1px solid #eee;
    padding-top: 5px;
  }
  .leaf {
    padding-left: 1.5rem;
    display: flex;
    gap: 4px;
    margin: 2px 0;
  }
</style>
