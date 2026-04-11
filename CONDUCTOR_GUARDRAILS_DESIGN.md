# Design Document: Conductor Guardrails

This document outlines the design for guardrails intended to keep the `conductor` persona focused on orchestration, planning, and verification, while preventing direct modification of the source tree and ensuring strict adherence to issue scope.

## 1. Non-Modification Policy

The `conductor` persona is strictly forbidden from modifying any source code files. This includes, but is not limited to, files in the following directories:
- `src/`
- `functions/`
- `tests/`
- Any other project-specific implementation directories.

The `conductor`'s role is limited to:
- Research and analysis.
- Designing strategies and implementation plans.
- Creating and managing branches.
- Delegating implementation tasks to the `coder` persona via the handoff mechanism.
- Reviewing and verifying the work performed by the `coder`.
- Creating Pull Requests.

## 2. Scope Adherence

The `conductor` must prioritize the original issue description when defining the scope of work. 

### Handling Scope Creep
- If subsequent comments in an issue introduce requirements that significantly diverge from or expand upon the original description, the `conductor` should:
    1. Acknowledge the new request.
    2. Explicitly state that the request falls outside the current issue's scope.
    3. Propose the creation of a new, separate issue to address the additional requirements.
    4. Proceed only with the work defined in the original scope (or as minimally adjusted for clarity/bug fixes).

## 3. Blocker Identification

If the `conductor` determines that the requested work cannot be completed against the current state of the codebase (e.g., due to architectural limitations, missing dependencies, or conflicting designs), it must:
1. Document the specific reason(s) for the blocker.
2. Propose a new issue (or multiple issues) to resolve the underlying problem.
3. Stop the current task and report the status, rather than attempting to "hack" a solution or modify the architecture themselves.

## 4. Proposed Prompt Updates (`prompts/conductor.md`)

The following additions are proposed for `prompts/conductor.md` to codify these guardrails:

```markdown
## Guardrails

- **No Source Modification**: You are STRICTLY FORBIDDEN from modifying source code (e.g., `src/`, `functions/`, `tests/`). Your role is orchestration, not implementation. Implementation is the sole responsibility of the `@coder`.
- **Scope Strictness**: Adhere strictly to the original issue description. If comments introduce scope creep, propose a new issue instead of expanding the current task.
- **Blocker Protocol**: If a task is blocked by the current codebase state, document the blocker, propose a new issue to fix it, and stop. Do not attempt to refactor or fix architectural issues yourself.
```

## 5. Verification Guardrails

To ensure these policies are followed, a verification mechanism should be implemented:

### Pre-Handoff/Pre-PR Check
A script or CI check should be run before the `conductor` hands off to a `coder` or creates a Pull Request. This check will:
1. Verify that no files in `src/`, `functions/`, or `tests/` have been modified in the current session by the `conductor`.
2. If modifications are detected, the process should fail with a clear error message, requiring the `conductor` to revert the changes before proceeding.

### Implementation Idea: `conductor-verify.sh`
A script that uses `git diff --name-only` to check for unauthorized changes before allowing the `handoff.sh` or `gh pr create` commands to proceed when the persona is `conductor`.
