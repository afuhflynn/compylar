# Compylar CLI Contract

## Commands

| Command | Purpose |
|---|---|
| `init [path]` | Create `.compylar/config.json`. |
| `compile [path]` | Analyze the scope and create a successful baseline. |
| `brain [path]` | Explain the latest compiled facts. |
| `analytics [path]` | Display detailed metrics from the latest compiled Brain. |
| `context <task> [path]` | Return an agent-ready task context result. |
| `memory <query> [path]` | Return compact, evidence-backed symbol, route, and memory matches. |
| `routes [path]` | List verified routes with optional filters. |
| `mcp [path]` | Run the read-only MCP server over stdio. |
| `mcp-health [path]` | Verify Compylar's `initialize` and `tools/list` protocol contract. |
| `install-agent [path]` | Preview or explicitly install the portable skill for one supported agent. |
| `status [path]` | Compare current files with the last successful baseline. |
| `diff [path]` | Compatibility alias for `status`. |
| `doctor [path]` | Check package, Git, and compiled-state prerequisites. |

## Output modes

Commands that return data support `--json`. Human output must explain scope, counts, evidence status, and the next useful command. JSON output must contain the same facts without terminal decoration.

`compile` additionally supports `--resume`, `--no-ai`, `--quiet`, `--progress`, `--analytics`, `--max-files`, `--max-file-size`, `--max-total-bytes`, and `--timeout`. AI is off unless `.compylar/config.json` sets `ai.mode` to `optional`; `--no-ai` always disables it for that run. Provider, model, and timeout belong in config, while credentials remain environment/secret-manager only. Progress is written to stderr so stdout remains usable as a report or JSON stream.

`refresh [path]` first checks the repository manifest captured by the last successful compile. If it is stale, Compylar recompiles with cache reuse; unchanged source files retain their existing extracted knowledge. The command accepts the same analysis and output options as `compile`. `status` reports additions, modifications, and deletions across tracked repository files—not only source files—and `--check` exits 1 when the baseline is stale.

`brain` defaults to a compact executive report. `brain --routes` adds a formatted route table, `brain --dependencies` adds dependency categories and unresolved imports, and `brain --full` adds all expanded inventories. `brain --json` preserves the machine-readable Brain object and contains no terminal decoration.

`context` returns transient metadata-first context by default, including relevant reusable memory chunks alongside selected source evidence. It omits raw source previews unless `--include-preview` is explicit. `--budget <tokens>` defaults to 2000 estimated tokens across the entire response and reports evidence omitted for budget. `context --ai` enables optional AI reranking and interpretation of deterministic candidates. `context --export [path]` explicitly writes a Markdown snapshot; no context file is created otherwise. Ambiguous requests return `needs-clarification` in JSON and do not create an artifact. Context retrieval is read-only and never authorizes repository mutations.

`memory <query>` ranks exact symbols first, then evidence-backed near matches, reusable memory facts, and routes. Each match includes its kind, definition, source, location when known, and confidence; it never returns source previews. `routes --filter <text>` optionally combines `--area`, `--kind page|layout|api`, and `--limit <number>` against the latest verified Brain.

`mcp [path]` exposes `compylar_brain`, `compylar_analytics`, `compylar_memory`, `compylar_context`, `compylar_status`, `compylar_routes`, and `compylar_dependencies` over stdio. `compylar_memory` returns compact evidence-backed chunks, optionally filtered by text or source path. MCP tools are read-only and scoped to the repository passed when the server starts. Agents own clarification, approval, and mutation decisions.

`mcp-health [path]` verifies Compylar's MCP `initialize` and `tools/list` responses through the same request handler used by the stdio server. It reports the server version, tool names, elapsed time, and an actionable error; it exits non-zero when unhealthy. It does not launch an agent, inspect a user configuration, or approve any external agent connection.

`install-agent [path] --agent codex|claude|opencode --scope project` is a dry-run by default. It prints the source and exact project destination; `--apply` copies the bundled portable skill only when the destination does not already exist. Codex and OpenCode install to `.agents/skills/compylar`; Claude installs to `.claude/skills/compylar`. The command never writes a home-directory/global configuration, existing skills, MCP configuration, or agent guidance files. It returns the separate documented MCP setup rather than applying it.

Progress modes are:

- `--progress auto` — a single in-place spinner in an interactive terminal; bounded phase messages when piped or running in CI.
- `--progress interactive` — request the spinner; automatically falls back to plain output when the terminal cannot render it.
- `--progress plain` — emit phase-level messages without animation. It never emits one line per source file.
- `--progress json` — emit structured progress events to stderr for integrations.
- `--progress none` — suppress progress. `--quiet` is a compatibility alias.

Compilation ends with a concise summary by default. Use `compile --analytics` or `analytics` for the complete table. `--json` disables terminal progress and emits machine-readable data on stdout.

AI enrichment is optional. `not-configured` means no provider credential was available; deterministic repository analysis still completed. `pending`, `completed`, `timed-out`, and `failed` describe the optional provider request, not repository health or the capabilities of an external coding agent. Compylar's core compiler works without OpenAI.

## Missing-state behavior

When `brain`, `context`, or `status` is run before compilation, the CLI reports the missing baseline and gives the exact compile command. Missing required arguments include a usage example.

When compilation is interrupted, the CLI preserves a checkpoint and reports `cancelled`; rerun `compylar compile --resume .` to continue.

## Exit behavior

Normal inspection commands return zero when they complete. `status --check` returns one when the baseline is stale. Analysis errors return non-zero and never replace a previous successful baseline.

## Distribution behavior

`pnpm build` regenerates `dist/cli.js`, marks it executable on POSIX systems, and verifies that property. Windows does not use POSIX executable bits; npm exposes the package bin through its `.cmd` launcher. `verify:cli-bin` runs the same release check independently.
