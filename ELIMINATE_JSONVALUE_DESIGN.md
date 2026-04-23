# Design Proposal: Eliminating `JsonValue` and `JsonObject`

## Objective

The goal of this design document is to propose a method for eliminating the `JsonValue` and `JsonObject` custom types and their associated Zod schemas across the Conductor codebase. As noted in issue #177, `JsonValue` serves essentially as a synonym for `any` but requires maintaining complex recursive type definitions and schemas that add little runtime safety while complicating the codebase.

## Motivation

1. **Simplicity:** The built-in TypeScript `unknown` type, paired with `Record<string, unknown>` for object structures, provides the same level of safety and flexibility without requiring custom definitions.
2. **Duplication:** `JsonValue` and `JsonObject` are defined redundantly in both `src/utils/types.ts` and `observability-ui/src/lib/types.ts`.
3. **Best Practices:** Overuse of generic "catch-all" types discourages defining strict interfaces where data structures are actually known. For truly dynamic data, `unknown` forces the consumer to perform proper type narrowing or validation.

## Proposed Strategy

### 1. Remove Custom Types and Schemas

Delete the following definitions entirely:
- `src/utils/types.ts`: `JsonValue`, `JsonObject`, `JsonValueSchema`, `JsonObjectSchema`
- `observability-ui/src/lib/types.ts`: `JsonValue`, `JsonObject`

### 2. Replace with Standard TypeScript Patterns

Where `JsonObject` is currently used to denote an object with string keys and arbitrary values, replace it with `Record<string, unknown>`. This is standard, built-in, and accomplishes the exact same constraints.

- `GeminiToolUseEvent.parameters`: Replace `JsonObject` with `Record<string, unknown>`
- `GeminiCallEvent.args`: Replace `JsonObject` with `Record<string, unknown>`
- `GeminiContextUpdateEvent.data`: Replace `JsonObject` with `Record<string, unknown>`
- `logger.ts` details/context parameters: Replace `JsonObject` with `Record<string, unknown>`
- `recover-orphans.ts` variables parameter: Replace `JsonObject` with `Record<string, unknown>`

### 3. Update Zod Schemas

In `src/utils/logger.ts`, wherever `JsonObjectSchema` is used to validate incoming or outgoing structured log payloads, replace it directly with `z.record(z.string(), z.unknown())`.

- `LogEventDataSchema` details field.
- `GeminiToolUseEventSchema` parameters field.
- `GeminiCallEventSchema` args field.
- `GeminiContextUpdateEventSchema` data field.

## Implementation Steps

1. Delete the definitions of `JsonValue` and `JsonObject` (and their Zod equivalents) from the relevant files.
2. In `src/utils/logger.ts`, replace the imported `JsonObject` type with `Record<string, unknown>` and `JsonObjectSchema` with `z.record(z.string(), z.unknown())`.
3. In `src/recover-orphans.ts`, update the `variables` parameter type to `Record<string, unknown>`.
4. In `observability-ui/src/lib/types.ts`, update all interface properties currently using `JsonObject` to `Record<string, unknown>`.
5. Run the TypeScript compiler (`npx tsc`) and all existing tests to ensure type safety and runtime validation are maintained.

## Conclusion

This approach completely removes the need for `JsonValue` while maintaining strict validation for fields that must be objects via `Record<string, unknown>`. It simplifies the type definitions across the project and aligns with idiomatic TypeScript and Zod usage.
