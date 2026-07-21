# Compylar CLI Contract

## Commands

| Command | Purpose |
|---|---|
| `init [path]` | Create `.compylar/config.json`. |
| `bootstrap [path]` | Create a local baseline and return the required agent-led semantic indexing checklist. |
| `ingest-index [path]` | Validate and ingest the bundled codebase-index semantic manifest. |
| `sync [path]` | Return the smallest trustworthy structural or delta re-index scope without mutating memory. |
| `compile [path]` | Analyze the scope and create a successful baseline. |
| `brain [path]` | Explain the latest compiled facts. |
| `analytics [path]` | Display detailed metrics from the latest compiled Brain. |
| `context <task> [path]` | Return an agent-ready task context result. |
| `overview [path]` | Return the deterministic repository profile for broad orientation. |
| `memory <query> [path]` | Return compact, evidence-backed symbol, route, and memory matches. |
| `learn <summary> [path]` | Record a cited agent discovery for durable reuse. |
| `memory-review <task> [path]` | Prepare the required cited memory delta after deep work. |
| `commit-memory [path]` | Validate and persist a post-work memory delta manifest. |
| `systems [path]` | List current system-scoped architecture memory. |
| `remember <summary> [path]` | Record a human-authoritative decision or note. |
| `routes [path]` | List verified routes with optional filters. |
| `install-agent [path]` | Preview or explicitly install the portable skill for one supported agent. |
| `setup-agent [path]` | Preview or explicitly install the portable skill plus a conflict-safe always-on project trigger. |
| `status [path]` | Compare current files with the last successful baseline. |
| `diff [path]` | Compatibility alias for `status`. |
| `doctor [path]` | Check package, Git, and compiled-state prerequisites. |

## Output modes

Commands that return data support `--json`. Human output must explain scope, counts, evidence status, and the next useful command. JSON output must contain the same facts without terminal decoration.

`compile` additionally supports `--resume`, `--no-ai`, `--quiet`, `--progress`, `--analytics`, `--max-files`, `--max-file-size`, `--max-total-bytes`, and `--timeout`. AI is off unless `.compylar/config.json` sets `ai.mode` to `optional`; `--no-ai` always disables it for that run. `--timeout` controls only optional AI requests. Agents must give compile, bootstrap, and refresh at least ten minutes of shell/tool execution allowance; when an agent-side timeout interrupts work, retry with a larger allowance and use `compile --resume --no-ai` when a checkpoint exists. Provider, model, and timeout belong in config, while credentials remain environment/secret-manager only. Progress is written to stderr so stdout remains usable as a report or JSON stream.

`refresh [path]` first checks the repository manifest captured by the last successful compile. If it is stale, Compylar recompiles with cache reuse; unchanged source files retain their existing extracted knowledge. The command accepts the same analysis and output options as `compile`. `status` reports additions, modifications, and deletions across tracked repository files—not only source files—and `--check` exits 1 when the baseline is stale.

`bootstrap` establishes only the deterministic local substrate. The coding agent must then run Compylar's bundled `CODEBASE_INDEX.md` workflow, write `CODEBASE_INDEX.md` and `.compylar/semantic-index.json`, and run `ingest-index`. The manifest is hash-bound to both the deterministic Brain and the human artifact; every persisted discovery carries current source citations. A Brain is semantically complete only after this validation. `sync` is read-only: it returns `semantic-index` for an incomplete Brain, otherwise classifies stale changes as `structural-index` or `delta-index`, reports affected direct dependents, and states the memory categories the agent must revisit before `refresh`.

`brain` defaults to a compact executive report. `brain --routes` adds a formatted route table, `brain --dependencies` adds dependency categories and unresolved imports, and `brain --full` adds all expanded inventories. `brain --json` preserves the machine-readable Brain object and contains no terminal decoration.

`overview` answers broad “what is this repository?” questions from a precomputed deterministic profile, never incidental file ranking. `context` returns transient metadata-first context by default, including a query plan, relevant reusable memory chunks, learned findings, and selected source evidence. It omits raw source previews unless `--include-preview` is explicit. `--budget <tokens>` defaults to 2000 estimated tokens across the entire response; budgets below 512 are rejected because they cannot carry the required trustworthy contract metadata. Compylar rejects any result it cannot fit within the requested budget rather than silently returning an oversized or incomplete pack. `context --ai` enables optional AI reranking and interpretation of deterministic candidates. `context --export [path]` explicitly writes a Markdown snapshot; no context file is created otherwise. Ambiguous requests return `needs-clarification` in JSON and do not create an artifact. Context retrieval is read-only and never authorizes repository mutations.

`learn` requires `--kind` and at least one `--source path:startLine-endLine`; it validates cited files and ranges against the current Brain and records the source hash. Use `--system` and `--key` for architecture facts so a later correction supersedes the prior stable key. `memory-review` is required after deep work and returns relevant current facts plus coverage gaps; `commit-memory --manifest` accepts only cited findings or a cited dismissal. `systems` groups current facts by system for senior-level architecture retrieval. `remember` stores a clearly labelled human-authoritative finding and may omit source citations. Refresh marks code-derived findings stale when their cited hash changes. `memory <query>` ranks exact symbols first, then evidence-backed near matches, reusable memory facts, learned findings, and routes. Each match includes its kind, definition, source, location when known, and confidence; it never returns source previews. `routes --filter <text>` optionally combines `--area`, `--kind page|layout|api`, and `--limit <number>` against the latest verified Brain.

`install-agent [path] --agent codex|claude|opencode --scope project` is a dry-run by default. It prints the source and exact project destination; `--apply` copies the bundled portable skill only when the destination does not already exist. Codex and OpenCode install to `.agents/skills/compylar`; Claude installs to `.claude/skills/compylar`. The command never writes a home-directory/global configuration, existing skills, or agent guidance files.

`setup-agent [path] --agent codex|claude|opencode --scope project` adds the
always-on trigger required for proactive use. It writes `AGENTS.md` for Codex,
`CLAUDE.md` for Claude Code, or `.opencode/AGENTS.md` for OpenCode only when
that exact file does not already exist. It never merges or overwrites existing
instructions; users review and merge the printed trigger themselves.

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
