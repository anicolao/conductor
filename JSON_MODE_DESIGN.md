# Design Proposal: Switching Gemini CLI to JSON Mode

## 1. Introduction
This document proposes switching the Gemini CLI output format from the current default (text) to `stream-json`. The goal is to provide deeper, more structured visibility into the agent's internal choices, tool usage, and performance metrics within the Conductor Observability UI.

## 2. Current State (Text Mode)
Currently, Conductor invokes Gemini CLI in text mode. The output is a mix of human-readable text, tool call blocks (often ANSI-encoded or delimited by markers), and terminal status messages.
- **Parsing**: Conductor wraps every line of `stdout`/`stderr` into a `::CONDUCTOR_EVENT::` with a `STDOUT` or `STDERR` type. The Observability UI then displays these lines as a raw terminal stream.
- **Limitations**:
    - Identifying tool calls requires complex regex or heuristic parsing of text.
    - Fine-grained timing for individual tool calls is difficult to extract.
    - Model-specific statistics (token usage, latency) are only available if the CLI prints a summary at the end, which then requires more parsing.

## 3. Proposed State (JSON Mode)
By using the `-o stream-json` flag, Gemini CLI emits a stream of discrete JSON objects, each representing a specific event in the agent's lifecycle.

### Key Event Types:
- `init`: Session metadata (ID, model used).
- `message`: Content chunks (deltas) for user or assistant messages.
- `tool_use`: Explicit structured data for tool name and parameters.
- `tool_result`: Explicit result status and output.
- `result`: Final summary including comprehensive stats.

## 4. Technical Details

### CLI Changes
Update the Gemini CLI invocation in `src/index.ts` to include:
```bash
npx @google/gemini-cli --prompt "..." --approval-mode yolo -o stream-json
```

### Backend (Conductor) Changes
- **Parser Update**: `runStreamingCommand` in `src/utils/exec.ts` or the logic in `src/index.ts` should be updated to:
    - Attempt to parse each line as JSON.
    - If successful, emit a new event type: `GEMINI_EVENT`.
    - If unsuccessful (e.g., YOLO warnings, debug logs, or stderr), fallback to the existing `STDOUT`/`STDERR` events.
- **Event Structure**:
  ```json
  {
    "event": "GEMINI_EVENT",
    "data": { ... parsed gemini json ... }
  }
  ```

### UI Changes
- **Event Timeline**: Update `EventTimeline.svelte` to handle `GEMINI_EVENT`.
- **Visualization**:
    - Create dedicated UI components for `tool_use` and `tool_result` (e.g., cards showing parameters and output).
    - Aggregate `message` deltas for smoother text display.
    - Display model stats from the `result` event in a structured dashboard.

## 5. Pros & Cons

### Pros
- **High Fidelity**: Direct access to structured tool call data without "scraping" text.
- **Real-time Stats**: Track token usage and latency per model and per turn.
- **Improved UI**: Enables rich visualizations (e.g., collapsible tool results, multi-model comparison charts).
- **Robustness**: JSON parsing is more reliable than regex-based text parsing, especially as the CLI evolves.

### Cons
- **Initial Effort**: Requires updating both the backend log collector and the frontend visualizer.
- **Log Size**: JSON-per-line can slightly increase the size of the overall log file.
- **Interleaving**: Must still handle non-JSON lines emitted by the CLI (warnings, startup logs).

## 6. Other Options Investigated
- **`--debug`**: Provides valuable routing information (model selection logic) and startup profiling.
    - **Recommendation**: Enable `--debug` and capture its text output alongside the JSON stream. Even though it's not JSON, the `[Routing]` logs provide "inner workings" visibility that is highly complementary to the JSON events.
- **`--output-format json`**: Provides a single JSON blob at the end.
    - **Recommendation**: Rejected in favor of `stream-json` as it prevents real-time observability.

## 7. Risks & Complexity
- **Schema Evolution**: If the `gemini-cli` JSON schema changes, the UI might need updates.
    - *Mitigation*: Use a permissive parser and fallback to raw JSON display for unknown types.
- **Complexity**: Low-Medium. The transition is additive and doesn't break the existing text-based logging; it just enhances it with structured data.

## 8. Conclusion
Switching to `stream-json` adds significant value to the observability goal with manageable complexity. It transforms the log from a "black box" terminal dump into a "traceable" execution graph.

**Recommendation**: Proceed with the implementation of `stream-json` and enhanced UI visualization.
