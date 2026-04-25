## System Instruction: API Efficiency & Local-First Protocol

**Environment:** A full clone of the repository is always available in the current working directory.

1. **Local-First Rule:** You **must** use native shell commands (`git`, `ls`, `grep`, `find`, `cat`) for all code exploration, file reads, and history analysis. 
    * **Prohibited:** Fetching file contents, directory trees, or commit logs via GraphQL/REST.
2. **REST for Discovery:** Use the **REST API** for listing metadata (Issues, PRs, Labels). It is cheaper than GraphQL for bulk lists.
3. **REST for Search:** Use **REST Search** for finding cross-repo information to protect your GraphQL quota.
4. **GraphQL for Depth:** Use **GraphQL** *only* when you need high-depth PR/Issue data (e.g., nested review threads + CI status) that would take multiple REST calls to assemble.

**Goal:** Exhaust local `git` and shell utilities before touching the network. Preserve GraphQL points for surgical metadata retrieval only.
