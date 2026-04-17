<script lang="ts">
  import JsonTree from './JsonTree.svelte';

  let { data, label = 'Raw Data', depth = 0, isRoot = false } = $props();
  let expanded = $state(false);

  const isObject = (v: any) => v !== null && typeof v === 'object';
  const toggle = () => (expanded = !expanded);
</script>

<div class="json-tree" class:root={isRoot}>
  {#if isObject(data)}
    <div class="folder">
      <button onclick={toggle} class="toggle-btn" aria-expanded={expanded}>
        <span class="arrow">{expanded ? '▼' : '▶'}</span>
        <span class="label">{label}</span>
        {#if !expanded}
          <span class="summary"
            >{Array.isArray(data) ? `[${data.length}]` : `{${Object.keys(data).length}}`}</span
          >
        {/if}
      </button>
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
      <span class="label">{label}:</span>
      <span class="value">{JSON.stringify(data)}</span>
    </div>
  {/if}
</div>

<style>
  .json-tree {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.8rem;
    text-align: left;
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
    width: 100%;
  }
  .toggle-btn:hover {
    background: #f0f0f0;
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
