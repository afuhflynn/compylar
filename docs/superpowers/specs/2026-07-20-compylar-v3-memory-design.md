# Compylar v3: Precise Persistent Engineering Memory

## Goal

Make Compylar's local Repository Brain precise enough that coding agents retrieve
durable, evidence-backed engineering memory before reopening source files. The
Brain remains local-first, deterministic, and source-citation-aware; optional AI
never establishes repository truth.

## Design

One deterministic evidence-retrieval module will serve the CLI and context
builder. It ranks exact symbols, structured repository facts, routes, memory
chunks, and learned findings using identifier-aware tokenization, query coverage,
source role, and direct relationships. Weak evidence returns an explicit gap
rather than a noisy file list.

The Brain migrates automatically from v2 to v3. v3 adds structured Prisma facts,
test relationships, proven static callers/callees, middleware/proxy guard facts,
workspace boundaries, safe documentation/configuration metadata, and snapshot
deltas. It indexes `.env.example` names only and never reads or stores secret
values.

Context retrieval begins with high-confidence seeds and follows directed,
role-aware relationships. Shared hubs such as type barrels do not cause broad
cascades unless they are direct query evidence. Source previews remain opt-in,
symbol/range-focused, and within the requested context budget.

## User interfaces

- `memory` gains exact matching, fact-kind filtering, result limits, and bounded
  full declarations.
- `references` exposes definition, callers, callees, related tests, and known
  guard relationships.
- `learned` lists, searches, and audits durable findings; finding IDs resolve
  through normal memory lookup.
- `routes` can show known protection boundaries.
- `compile-diff` compares stored snapshots without rereading source.
- Agent installation can compare an existing skill and only replaces it through
  explicit, recoverable opt-in.

## Reliability and compatibility

Existing Brains migrate automatically and retain their current facts. Refresh
builds only the newly required indexes while retaining incremental analysis.
Static analysis labels dynamic or unresolvable relationships as unknown. Declared
pnpm, npm, and Yarn workspaces are analyzed as separate packages, with proven
cross-package imports retained. Compylar state stays ignored and local by default.

## Verification

Tests exercise public behavior for exact and broad retrieval, Prisma parsing,
cross-workspace imports, caller/test/guard discovery, hub-resistant context,
learning auditability, snapshot diffs, secret safety, and installer recovery. The
final gate is `pnpm typecheck`, `pnpm test`, and `pnpm build`.
