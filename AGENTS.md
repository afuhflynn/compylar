# Compylar agent workflow

Compylar is persistent repository memory, not a code-writing agent. Before a non-trivial change, use the cheapest trustworthy path:

1. If a Brain exists, run `compylar status .`; otherwise run `compylar compile . --no-ai`.
2. If stale, run `compylar refresh . --no-ai` before relying on stored facts.
3. Retrieve task context with `compylar context "<task>" . --json`; use memory/context evidence before reopening unrelated files.
4. Read the selected source only when the task needs implementation detail or the evidence is insufficient.
5. After meaningful, validated repository changes, run `compylar status .` then `compylar refresh . --no-ai` to keep the Brain current.

Use `pnpm typecheck`, `pnpm test`, and `pnpm build` for Compylar changes. Keep deterministic facts authoritative; optional AI output never establishes repository truth. Research current framework or dependency guidance from official sources when a change depends on it.
