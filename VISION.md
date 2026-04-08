# VISION: Conductor

The goal of Conductor is to provide a "connective tissue" for the next generation of AI-driven development. 

## The Core Insight

While individual LLMs and coding agents are becoming incredibly capable, they still struggle with long-horizon, multi-faceted projects that require diverse skill sets (architecture, implementation, testing, documentation).

Previous attempts (Morpheum, Overseer) suffered from:
1. **Morpheum**: Over-engineered internal protocols and lack of real-world agency.
2. **Overseer**: A split between a simple first version that couldn't finish tasks, and a complex second version that was buried in boilerplate and "safety" logic.

## The Conductor Way

Conductor moves the "intelligence" to the agents themselves. The framework's job is not to dictate *how* an agent works, but to provide the *context* and *mechanism* for agents to collaborate.

### Principles

1. **Simplicity Over Protocol**: Use natural language and standard development artifacts (PRs, issues, commits) for communication.
2. **High-Agency Backends**: Rely on tools like Gemini CLI that are already "code-aware" and "filesystem-aware."
3. **Self-Evolution**: The primary metric for Conductor is its ability to implement its own feature requests.
4. **Transparent Orchestration**: No hidden state; everything is visible in the Git history and GitHub UI.

## Future State

In its final form, Conductor will allow a human "product manager" to file an issue describing a complex feature, and a fleet of coordinated agents will handle the architectural design, implementation, and verification, presenting a complete and tested PR for final approval.
