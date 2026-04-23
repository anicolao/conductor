# Design Proposal: Eliminating `JsonValue` with "Real Types"

## Objective

The goal of this design document is to replace the generic `JsonValue`, `JsonObject`, and their recent replacements (`unknown` and `Record<string, unknown>`) with strict, domain-specific interfaces ("real types"). This addresses the feedback in Issue #177 that the previous approach simply traded one form of `any` for another without adding actual type safety or structure ("no teeth").

## Background & Motivation

The Conductor system passes complex payloads in several areas:
1. **Tool Usage:** `GeminiToolUseEvent` captures the parameters passed to CLI tools.
2. **Structured Logging:** The `logger` captures arbitrary `details` attached to log messages.
3. **Internal Events:** `GeminiCallEvent` and `GeminiContextUpdateEvent` pass internal state.

Previously, these were modeled using `JsonValue` or `Record<string, unknown>`. This tells the developer nothing about the *shape* of the data expected or emitted, leading to runtime errors and making the Observability UI brittle. We need "real types" that describe the exact schemas of these payloads.

## Proposed Strategy: "Real Types"

### 1. Discriminated Unions for Tool Parameters

Instead of treating tool parameters as a black box, we will define a discriminated union of known tool parameters.

```typescript
// observability-ui/src/lib/types.ts & src/utils/types.ts

export interface ReadFileParameters {
    file_path: string;
    start_line?: number;
    end_line?: number;
}

export interface GrepSearchParameters {
    pattern: string;
    dir_path?: string;
    include_pattern?: string;
    // ... other grep args
}

export interface RunShellCommandParameters {
    command: string;
    is_background?: boolean;
    timeout?: number;
}

// A mapped type or union for all known tools
export type ToolParameters = 
    | { tool_name: "read_file"; parameters: ReadFileParameters }
    | { tool_name: "grep_search"; parameters: GrepSearchParameters }
    | { tool_name: "run_shell_command"; parameters: RunShellCommandParameters }
    | { tool_name: "replace"; parameters: { file_path: string; old_string: string; new_string: string } }
    // Fallback for unknown/future tools, explicitly marked as such
    | { tool_name: string; parameters: Record<string, unknown> };
```

This ensures that when a `GeminiToolUseEvent` is processed, TypeScript knows exactly what `parameters` contain based on the `tool_name`.

### 2. Context and Internal Event Types

Similarly, define specific interfaces for internal events.

```typescript
export interface GeminiContextUpdateData {
    memories?: Array<{ scope: string; fact: string }>;
    branch?: string;
    labels?: string[];
    // Define the actual fields passed in context updates
}

export interface GeminiCallArgs {
    prompt?: string;
    agent_name?: string;
    wait_for_previous?: boolean;
    // Define the actual fields passed to internal calls
}
```

### 3. Generic-Driven Structured Logging

The `logger` currently accepts `Record<string, unknown>` for details. We will update the logger to use Generics to enforce type definitions at the call site.

```typescript
// src/utils/logger.ts

export const logger = {
    info: <T>(
        message: string,
        details?: T,
        context?: { persona?: string; issue?: number },
    ) => logEvent("LOG_INFO", details ? { message, details } : { message }, context),
    // ... apply to warn, error, debug
};
```

While the underlying `ConductorEvent` schema will need a broader type to accept these diverse payloads (likely a union of defined schemas or a fallback Zod schema), this forces the *caller* to provide a specific shape.

### 4. Zod Schema Strictness

Update `JsonObjectSchema` in `src/utils/logger.ts`. Instead of a generic `z.record(z.string(), z.unknown())`, we will use `z.union()` with `.strict()` object definitions for known payloads, falling back to a structured, but less strict, schema only when absolutely necessary.

```typescript
const ToolParametersSchema = z.union([
    z.object({ file_path: z.string(), start_line: z.number().optional() /* ... */ }).strict(),
    z.object({ command: z.string() /* ... */ }).strict(),
    // ...
]);
```

## Implementation Steps

1. **Define Real Types:** Create the strict interfaces (`ReadFileParameters`, `GeminiContextUpdateData`, etc.) in a shared location (e.g., `src/utils/types.ts` and `observability-ui/src/lib/types.ts`).
2. **Update Zod Schemas:** Modify `src/utils/logger.ts` to replace `JsonObjectSchema` with unions of strict schemas corresponding to the new types.
3. **Refactor Call Sites:** Search the codebase for `logger.info`, `logger.error`, etc., that pass `details`, and explicitly type those details.
4. **Update UI:** Refactor `observability-ui/src/lib/components/JsonTree.svelte` and event rendering logic to leverage the new discriminated unions, allowing for tailored UI components based on the specific tool or event type.

## Alternatives Considered

*   **Keeping `Record<string, unknown>`:** Rejected by the user. It lacks the constraints necessary for a robust, maintainable codebase and provides no intellisense or compile-time guarantees about payload structure.
*   **Generating Types from JSON Schema:** Overly complex for the current scale. Manually defining the core tool and event interfaces is more straightforward and idiomatic TypeScript.
