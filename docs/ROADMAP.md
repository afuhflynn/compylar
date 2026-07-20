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
- [x] Expose read-only Brain, status, memory, and context through MCP.
- [x] Keep CLI and MCP release versions synchronized.
- [x] Make AI enrichment off by default and keep credentials outside project config.

## Build Week release — next

- [x] Add a reproducible one-command demo that proves compile → context → status → refresh.
- [x] Surface memory refresh counts in human CLI output and demo output.
- [x] Add benchmark fixtures and report selected files, chunk reuse, and elapsed time.
- [x] Package CLI, skill, and guidance intentionally for npm distribution.
- [x] Preserve the generated CLI executable entrypoint across clean POSIX builds; support Windows through npm's bin launcher.
- [x] Add a first-60-seconds Quick Start, compact first-run proof, and Codex/Claude/OpenCode onboarding.
- [x] Add conservative agent installation with explicit agent and scope selection.
- [x] Document Codex/Claude-compatible MCP configuration without writing user configuration implicitly.
- [x] Verify live submission rules, category, deadline, and required Codex evidence.
- [ ] Complete the judge-ready submission package, video, and Devpost form before the deadline.

## Memory quality

- [x] Track entry points, configuration, documentation, and test strategy as richer first-class chunks.
- [ ] Invalidate direct dependents when an exported source contract changes.
- [ ] Record explicit unknowns and confidence changes as queryable memory.
- [ ] Add chunk-level history and explain why a chunk was updated, reused, or removed.
- [x] Add a compact `memory` CLI report for human inspection.

## Agent interoperability

- [x] Ship a portable skill with a freshness-first workflow.
- [x] Ship concise `AGENTS.md` guidance for this repository.
- [x] Add tested adapters for supported agent configuration locations.
- [x] Add an installer dry-run and rollback-safe write plan.
- [x] Add MCP protocol health checks and actionable diagnostics.
- [x] Add a request budget to context retrieval and report excluded evidence.

## Analysis depth

- [x] Add deterministic system retrieval through code-aware lexical matching and bounded internal dependency expansion.
- [x] Add entry-point and configuration inventory extraction.
- [ ] Support exports/re-exports, cross-package imports, and more package managers.
- [ ] Add framework adapters through isolated, tested modules.
- [ ] Add data-flow and API-contract facts where deterministic evidence exists.
- [ ] Add language support only with fixture coverage and clear capability boundaries.

## Reliability and governance

- [ ] Add schema migration functions before a breaking Brain or Memory schema change.
- [ ] Add repository-level secret/sensitive-path exclusion policy.
- [ ] Add deterministic performance regression tests for status, refresh, and context.
- [ ] Add structured diagnostics for partial analysis and unsupported conventions.
- [ ] Add a release checklist that validates package contents, version synchronization, docs, and fixtures.

## Long-term platform — deliberately deferred

- [ ] SDK and hosted API.
- [ ] Shared/team Brains, permissions, and auditability.
- [ ] Background indexing and remote Git synchronization.
- [ ] Technology Brain built from official external documentation.
- [ ] Dashboard, collaboration, billing, and enterprise controls.
