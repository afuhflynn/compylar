# Compylar Engineering Roadmap

This roadmap is a working control surface. Mark work complete only when its implementation, tests, and user-facing contract agree.

## Product invariant

Compylar must reduce repeated repository discovery without becoming an untrusted source of truth. Deterministic evidence wins; AI is optional; stale memory is never silently presented as current.

## Foundation — complete

- [x] Compile a repository into validated, evidence-backed deterministic facts.
- [x] Persist latest Brain plus historical SQLite snapshots.
- [x] Generate task context without requiring an API key.
- [x] Detect added, changed, and deleted repository paths beyond source files.
- [x] Refresh with unchanged-source cache reuse.
- [x] Reconcile typed memory chunks by stable ID and source fingerprint.
- [x] Make AI enrichment off by default and keep credentials outside project config.

## Build Week release — next

- [x] Add a reproducible one-command demo that proves compile → context → status → refresh.
- [x] Surface memory refresh counts in human CLI output and demo output.
- [x] Add benchmark fixtures and report selected files, chunk reuse, and elapsed time.
- [x] Package CLI, skill, and guidance intentionally for npm distribution.
- [x] Preserve the generated CLI executable entrypoint across clean POSIX builds; support Windows through npm's bin launcher.
- [x] Add a first-60-seconds Quick Start, compact first-run proof, and Codex/Claude/OpenCode onboarding.
- [x] Add conservative agent installation with explicit agent and scope selection.
- [x] Verify live submission rules, category, deadline, and required Codex evidence.
- [ ] Complete the judge-ready submission package, video, and Devpost form before the deadline.

## Memory quality

- [x] Track entry points, configuration, documentation, and test strategy as richer first-class chunks.
- [x] Invalidate direct dependency facts when an internal target source changes.
- [ ] Record explicit unknowns and confidence changes as queryable memory.
- [ ] Add chunk-level history and explain why a chunk was updated, reused, or removed.
- [x] Add a compact `memory` CLI report for human inspection.
- [x] Add a deterministic repository profile for broad orientation without lexical file ranking.
- [x] Add strict-citation learned memory with source-hash stale invalidation.
- [x] Add explicit agent guidance for memory-first, source-exception work.
- [x] Add an agent-led bootstrap checklist and adaptive structural/delta sync planner.
- [x] Bundle the required codebase-index workflow; validate its cited semantic manifest before a Brain is considered semantically complete.
- [x] Migrate Repository Brains to v3 automatically and retain historical snapshots.
- [x] Make learned findings queryable and auditable through CLI and retrieval.
- [x] Add exact/ranked memory lookup, bounded stored declarations, static references, and compile diffs.
- [x] Require a post-deep-work memory transaction with cited findings or dismissal, stable-key supersession, and system-scoped architecture retrieval.

## Agent interoperability

- [x] Ship a portable skill with a freshness-first workflow.
- [x] Ship concise `AGENTS.md` guidance for this repository.
- [x] Add tested adapters for supported agent configuration locations.
- [x] Add an installer dry-run and rollback-safe write plan.
- [x] Add a request budget to context retrieval and report excluded evidence.
- [x] Make the portable skill a default repository-work workflow with bootstrap, sync, and post-work learning requirements.
- [x] Add conflict-safe skill-plus-trigger setup for verified Codex, Claude Code, and OpenCode project profiles.
- [ ] Add separately verified Cursor, Copilot, Cline, Windsurf, Continue, and Aider setup profiles; do not treat their instruction surfaces as universal.

## Analysis depth

- [x] Introduce language-neutral file, route, package, and capability schemas.
- [x] Add a Python proof adapter for definitions, imports, pytest references, and FastAPI route conventions.
- [ ] Extract TypeScript/JavaScript, Next.js, and Prisma extraction fully behind the shared adapter interface.
- [x] Add a Go proof adapter for functions, imports, `_test.go` references, and standard-library HTTP routes.
- [x] Add a Rust proof adapter for Cargo source, definitions, tests, and conservative Axum route conventions.
- [ ] Add Django/Flask after the Python core adapter is independently stable.
- [x] Add deterministic system retrieval through code-aware lexical matching and bounded internal dependency expansion.
- [x] Fail closed for weak retrieval evidence and vague debugging requests; never label fallback files as a proven system.
- [x] Enforce a hard context budget contract; reject budgets too small to carry trustworthy context metadata.
- [x] Add entry-point and configuration inventory extraction.
- [x] Support exports/re-exports and declared pnpm workspace package discovery, including inline workspace patterns.
- [ ] Complete cross-package symbol resolution and npm/Yarn workspace discovery.
- [ ] Add framework adapters through isolated, tested modules.
- [x] Add deterministic Prisma declarations, direct call/test references, and middleware/guard facts where evidence exists.
- [ ] Add broader data-flow and API-contract facts where deterministic evidence exists.
- [ ] Add language support only with fixture coverage and clear capability boundaries.

## Reliability and governance

- [x] Add schema migration functions before a breaking Brain or Memory schema change.
- [x] Add repository-level secret/sensitive-path exclusion policy: `.env` values are never indexed; safe configuration metadata only.
- [ ] Add deterministic performance regression tests for status, refresh, and context.
- [ ] Add structured diagnostics for partial analysis and unsupported conventions.
- [ ] Add a release checklist that validates package contents, version synchronization, docs, and fixtures.

## Long-term platform — deliberately deferred

- [ ] Reconsider a read-only MCP integration only after the CLI-and-skill workflow proves a genuine need.
- [ ] SDK and hosted API.
- [ ] Shared/team Brains, permissions, and auditability.
- [ ] Background indexing and remote Git synchronization.
- [ ] Technology Brain built from official external documentation.
- [ ] Dashboard, collaboration, billing, and enterprise controls.
