# Compylar agent workflow

Compylar is persistent repository memory, not a code-writing agent. Before a non-trivial change, use the cheapest trustworthy path:

1. If no Brain exists, run `compylar bootstrap . --json`, follow the bundled `skills/compylar/CODEBASE_INDEX.md` workflow, then run `compylar ingest-index .` before feature work. Give bootstrap/compile/refresh at least a 10-minute agent command allowance; if interrupted, retry with a larger allowance and `compylar compile . --resume --no-ai` where applicable. Otherwise run `compylar status .`.
2. If stale, run `compylar sync . --json`, complete its structural or delta index scope, then run `compylar refresh . --no-ai` before relying on stored facts.
3. For broad orientation, use `compylar overview . --json`; otherwise retrieve task context with `compylar context "<task>" . --json`. Use memory/context evidence before reopening unrelated files.
4. Read source only when Compylar reports a targeted read is required, or when an exact current edit range is necessary. Never read files merely to rediscover foundation or architecture.
5. After meaningful, validated deeper work, record durable source-backed discoveries with `compylar learn "..." --kind <kind> --source path:start-end`; record human decisions with `compylar remember`.
6. After meaningful, validated repository changes, run `compylar status .`, `compylar sync . --json`, then `compylar refresh . --no-ai` to keep the Brain current.

Use `pnpm typecheck`, `pnpm test`, and `pnpm build` for Compylar changes. Keep deterministic facts authoritative; optional AI output never establishes repository truth. Research current framework or dependency guidance from official sources when a change depends on it.
