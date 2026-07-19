# Compylar Compiler Specification

## Purpose

Compylar must produce repository knowledge that an engineering agent can trust. A fact is only useful when its scope, source evidence, and confidence are visible.

## Compile pipeline

```text
repository root
  -> package/workspace discovery
  -> package-scoped file discovery
  -> TypeScript/JavaScript parsing
  -> symbol/import/route extraction
  -> local module resolution
  -> evidence-backed Repository Brain
  -> SQLite snapshot + JSON/Markdown exports
```

Compilation is bounded by configurable file-count, file-size, and total-source-byte limits. It emits progress by phase, persists checkpoints during long runs, and returns a partial Brain with explicit warnings when a limit is reached.

## Repository boundaries

The root package is always analyzed. Packages declared by `pnpm-workspace.yaml` are analyzed as separate package units. Nested `package.json` files not declared as workspace packages are reported as excluded nested projects and can be compiled directly by passing their path.

No source file may belong to more than one package unit in a single compile.

## Facts and interpretation

Deterministic facts include:

- package ownership
- file paths and hashes
- symbols and source locations
- imports and exports
- resolved internal edges
- external dependencies
- framework routes
- diagnostics
- scripts and package dependencies

AI interpretation may add architecture prose, risks, and task summaries. It must never change deterministic facts. It is disabled by default and can be enabled only through non-secret project configuration (`provider`, `mode`, `model`, and timeout). Credentials are supplied outside the repository through an environment variable or secret manager. AI output includes its model, status, timestamp through the compile snapshot, and failure information.

## Brain v2

`RepositoryBrain` is versioned with `brainVersion: 2`. Its top-level collections are packages, files, symbols, routes, dependency edges, diagnostics, ignored projects, reusable memory, and AI enrichment. Reusable memory includes repository, package, module, route, dependency, test-strategy, entry-point, configuration, and documentation chunks. Optional additions remain backward-compatible with older v2 snapshots.

Every route, package, and source file carries evidence containing a source path, explanation, and confidence. Repository Memory has its own `schemaVersion`. It contains stable, typed chunks (repository, package, module, route, dependency, and test strategy), each with source paths, a source fingerprint, evidence, confidence, and lifecycle timestamps. On refresh, a matching ID and source fingerprint reuses the exact existing chunk; changed evidence updates only that chunk, and missing evidence removes its chunk.

## Persistence

SQLite stores successful compile snapshots under `.compylar/brain.db`. `brain.json` is the validated latest export for inspection and automation. A failed compile must not replace the latest successful baseline.

Interrupted runs persist `.compylar/checkpoint.json`. `compile --resume` reuses unchanged file analyses from the checkpoint or latest Brain. `status` performs only bounded enumeration and hashing; it does not construct TypeScript projects or invoke AI.

## Status semantics

`status` scans the current filesystem without writing a new baseline. It compares the repository manifest captured at compile time—including source, documentation, configuration, manifests, lockfiles, additions, and deletions—and reports added, changed, and deleted paths. `refresh` reuses unchanged source analysis and reconciles only affected memory chunks. `status --check` returns exit code 1 when stale so CI can enforce freshness.

## Agent context

Context retrieval combines task terms, paths, symbols, package names, graph proximity, and matching reusable memory chunks. Each selected file includes its package, score, reason, symbols, and bounded source preview. The pack explicitly states constraints, assumptions, and excluded context.
