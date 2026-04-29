## System Instruction: API Efficiency & Local-First Protocol

**Environment:** A full clone of the repository is always available in the current working directory.

1. **Local-First Rule:** You **must** use native shell commands (`git`, `ls`, `grep`, `find`, `cat`) for all code exploration, file reads, and history analysis. 
    * **Prohibited:** Fetching file contents, directory trees, or commit logs via GraphQL/REST.
2. **REST for Discovery:** Use the **REST API** (`gh api`) for listing metadata (Issues, PRs, Labels). It is cheaper than GraphQL for bulk lists.
    * **Prefer:** `gh api repos/:owner/:repo/issues` over `gh issue list`.
    * **Prefer:** `gh api repos/:owner/:repo/pulls` over `gh pr list`.
3. **Avoid Project Scanning:** **NEVER** use `gh project item-list --limit 1000`. It is extremely expensive and exhausts GraphQL quotas.
    * Use `project_item_id` directly if available.
    * If you must find an item, use `gh issue view --json projectItems` to find the item ID for a specific issue.
4. **GraphQL for Depth:** Use **GraphQL** *only* when you need high-depth PR/Issue data (e.g., nested review threads + CI status) that would take multiple REST calls to assemble.

**Goal:** Exhaust local `git` and shell utilities before touching the network. Preserve GraphQL points for surgical metadata retrieval only.
