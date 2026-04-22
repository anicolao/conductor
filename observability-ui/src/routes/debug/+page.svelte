<script lang="ts">
import EventTimeline from "$lib/components/EventTimeline.svelte";
import { parseLogs } from "$lib/parser";

let rawLogs = $state("");
let events = $derived(parseLogs(rawLogs));
</script>

<div class="debug-page">
  <h1>Conductor Log Parser Debug</h1>
  
  <section class="input-section">
    <h2>Raw Logs</h2>
    <textarea 
      bind:value={rawLogs} 
      placeholder="Paste your logs here (look for ::CONDUCTOR_EVENT:: markers)"
      rows="10"
    ></textarea>
  </section>

  <section class="output-section">
    <h2>Parsed Timeline</h2>
    <EventTimeline {events} />
  </section>
</div>

<style>
  .debug-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: system-ui, -apple-system, sans-serif;
  }

  h1 {
    color: #333;
    border-bottom: 2px solid #007bff;
    padding-bottom: 0.5rem;
  }

  section {
    margin-bottom: 2rem;
  }

  h2 {
    font-size: 1.2rem;
    color: #555;
  }

  textarea {
    width: 100%;
    padding: 0.5rem;
    font-family: monospace;
    font-size: 0.9rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
  }

  .output-section {
    background: #fff;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
</style>
