# Compylar Research Notes

## TypeScript analysis

Compylar uses TypeScript and ts-morph for the first language slice. ts-morph can load a specific `tsconfig.json`, expose compiler-backed source files, and support module-resolution workflows. This is preferable to regex-only parsing for TypeScript repositories.

## Multi-language direction

Tree-sitter is reserved for future language adapters. It is designed for incremental parsing and can remain useful even when source files contain syntax errors. It should supplement, not replace, TypeScript semantic resolution for the TypeScript/JavaScript MVP.

## Dependency graphs

The first graph implementation is intentionally small and evidence-backed. dependency-cruiser is a useful reference and optional validation tool because it supports TypeScript dependency analysis, graph output, caching, and architectural rules. Compylar’s graph must additionally preserve package ownership, source evidence, and unresolved edges.

## CLI framework

Commander remains the current CLI dependency because it is already installed and is sufficient for the MVP’s explicit command contract. oclif is a strong future option if Compylar adds plugins, command packages, or an extension marketplace; switching frameworks now would not solve the compiler’s correctness problems.

## Workspace model

pnpm workspaces are detected from `pnpm-workspace.yaml`. Root packages and workspace packages are separate analysis units; undeclared nested package projects are reported and excluded from the parent scope.

## AI role

OpenAI Responses API enrichment is optional in operational terms: deterministic facts remain authoritative, and a key alone cannot activate enrichment. The project config controls provider, mode, model, and timeout; credentials remain outside repository configuration through the environment or a secret manager.

## Terminal progress and analytics

The compiler emits progress events for discovery, hashing, extraction, persistence, and optional AI enrichment. `ora` is used as the interactive renderer because its single-spinner model matches compilation: only the current phase and current file need to be visible, while previous file events should disappear rather than accumulate in the terminal. It also supports TTY-aware rendering, stderr output, and success/failure cleanup.

`listr2` was considered but not selected for compile progress. Its task-list renderers are useful when users need several persistent task rows; that would work against Compylar’s one-current-change UX and add an unnecessary task abstraction around the existing event stream.

`cli-table3` is used for static `brain` and `analytics` reports. Tables are rendered only after analysis, where wrapping and truncation make package paths and metrics easier to inspect. Live progress is never rendered as a table.

Progress rendering is deliberately separate from compilation. Interactive terminals receive one in-place spinner, CI and pipes receive bounded phase messages, integrations can request structured JSON events on stderr, and `--json` keeps stdout reserved for the final machine-readable Brain.
