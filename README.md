# Compylar

Compylar is a local Knowledge Compiler for AI coding agents. It analyzes a TypeScript or JavaScript repository, records evidence-backed repository facts and learned discoveries, and creates task-specific context packs that an agent can use without rediscovering the whole codebase.

## What it guarantees

- Package boundaries are discovered before source files are analyzed.
- Nested standalone projects are excluded unless explicitly compiled.
- Routes are reported only when framework conventions and source evidence match.
- Internal imports are resolved to real files when possible.
- AI summaries are labeled as non-authoritative interpretations.
- `status` compares the working tree with the last successful compile baseline.
- Memory chunks have stable identities, source fingerprints, and evidence; unchanged chunks survive refreshes unchanged.

## First 60 seconds

From a Compylar checkout, install the CLI once:

```bash
pnpm install
pnpm build
npm link
```

Then, in the repository you want an agent to understand:

```bash
cd /path/to/your-repository
compylar setup-agent . --agent codex --scope project --apply
```

Start Codex and give it a concrete task:

> Add authentication to the dashboard. Use Compylar first: check freshness, retrieve task context, then read only the necessary source.

No API key is required. On its first session the bundled skill makes the agent run: bootstrap/compile → deep `codebase-index` → validated semantic-memory ingest. Later sessions use: status → context/memory → targeted reads → tests → scoped refresh. Give initial compile/bootstrap/refresh at least 10 minutes of agent command time; retry with a larger allowance if interrupted.

Compylar works alongside the coding agent: the agent performs the meaningful repository exploration, while Compylar preserves concise cited discoveries, detects staleness, and tells the next agent session exactly what must be revisited. Start an unfamiliar repository with `compylar bootstrap .`; use `compylar sync .` when memory is stale to distinguish structural re-indexing from a bounded delta update. After deep work, the agent runs `compylar memory-review` and commits a cited memory delta (or a cited dismissal), so architecture knowledge grows without relying on a user reminder.

For users, this should be seamless: ask for normal engineering work. A correctly installed agent uses Compylar automatically; it does not wait for you to say “use memory,” “index this,” or “refresh the Brain.”

For another agent, replace the installation command with one of these:

```bash
# Claude Code
compylar setup-agent . --agent claude --scope project --apply

# OpenCode
compylar setup-agent . --agent opencode --scope project --apply
```

`setup-agent` is the recommended path: it installs both the detailed Compylar
skill and the short always-on project instruction that makes agents load it for
ordinary repository work. If the target instruction file already exists,
Compylar refuses to overwrite it; merge the printed Compylar trigger into your
existing project guidance.

## First agent session

You do not need to ask an agent to index, remember, or refresh the repository.
After `setup-agent`, use normal prompts such as:

> What does this repository do?

> Implement two-factor authentication.

> Investigate why challenge submissions fail.

When no semantic Brain exists, the installed workflow automatically performs:

```text
deterministic bootstrap → bundled deep codebase index → cited manifest ingest
```

After deeper work, it performs a cited memory review and refreshes only the
affected knowledge. The agent surfaces only material findings, genuine evidence
gaps, or blockers.

## Requirements

- Node.js 22.5 or newer
- pnpm

## Build from source

```bash
pnpm install
pnpm build
```

The build verifies that the generated CLI entrypoint is executable on POSIX systems. On Windows, npm provides the normal `.cmd` launcher instead; no Unix permission bit is required.

## Basic workflow

```bash
# Initialize state
node dist/cli.js init .

# Analyze and create a successful baseline
node dist/cli.js compile .

# Read the facts and evidence summary
node dist/cli.js brain .

# Opt into detailed inventories when needed
node dist/cli.js brain . --routes
node dist/cli.js brain . --dependencies
node dist/cli.js brain . --full

# Display the detailed compile metrics
node dist/cli.js analytics .

# Answer a broad architecture question without selecting arbitrary files
node dist/cli.js overview .

# Establish the first local baseline and the agent's semantic-index checklist
node dist/cli.js bootstrap .

# After the bundled agent-led deep index creates CODEBASE_INDEX.md and its manifest,
# validate and persist the cited semantic findings
node dist/cli.js ingest-index .

# Plan the smallest memory update after repository changes
node dist/cli.js sync .

# Create context for a coding task
node dist/cli.js context "add authentication to the dashboard" .

# Look up a type or symbol without source previews
node dist/cli.js memory SubmissionDetail .

# Preserve a verified discovery for the next agent session
node dist/cli.js learn "Session guard redirects unauthenticated requests." . --kind flow --source lib/auth.ts:10-34

# Required after targeted reads, debugging, refactoring, or validated implementation work
node dist/cli.js memory-review "add dashboard authentication" . --files lib/auth.ts --changed app/dashboard/page.tsx --json
# The agent writes the cited JSON delta, then Compylar validates and persists it
node dist/cli.js commit-memory . --manifest .compylar/memory-delta.json

# Retrieve architecture-grade memory by system in later sessions
node dist/cli.js systems . --query authentication

# List only verified routes matching a feature area
node dist/cli.js routes . --filter challenges

# Request bounded implementation excerpts only when needed
node dist/cli.js context "fix dashboard loading" . --include-preview --budget 2000

# Optional AI reranking of verified candidates
node dist/cli.js context "explain the authentication flow" . --ai

# Explicitly export a Markdown handoff
node dist/cli.js context "add authentication to the dashboard" . --export

# Check whether knowledge is stale
node dist/cli.js status .

```

For large repositories, compile progress is shown as one live status line in an interactive terminal. Use bounded resumable compilation when needed:

```bash
node dist/cli.js compile . --resume --quiet
node dist/cli.js compile . --max-files 25000 --max-file-size 1048576
node dist/cli.js doctor .
```

Control progress explicitly when embedding Compylar in another tool:

```bash
node dist/cli.js compile . --progress plain
node dist/cli.js compile . --progress none
node dist/cli.js compile . --progress json 2> progress.ndjson
node dist/cli.js compile . --analytics
```

Progress is written to stderr. Reports and `--json` output are written to stdout, so agents can consume them without parsing spinner output.

Compilation reports `complete`, `partial`, or `cancelled`. Press `Ctrl-C` to save a checkpoint, then rerun with `--resume`.

`compylar status .` compares the current repository against the compile-time manifest. It tracks source files, documentation, configuration, package manifests, lockfiles, additions, and deletions without storing file contents. When knowledge is stale, run `compylar refresh .`: it reuses unchanged source analysis and recompiles only what needs fresh extraction.

Generated state lives in `.compylar/`:

- `brain.db` — SQLite snapshots and future queryable facts
- `brain.json` — validated machine-readable export
- `brain.md` — readable Brain report
- `checkpoint.json` — resumable work from an interrupted compile

Context output is metadata-first: selected paths, symbols and locations, evidence, memory facts, and excluded context. Raw source excerpts are omitted unless `context --include-preview` is requested. `--budget` defaults to 2,000 estimated tokens across the whole response and reports evidence omitted by the budget. Markdown context files are snapshots and are created only with `context --export`.

Each Brain also contains compact reusable memory chunks for repository, package, module, route, dependency, and test-strategy facts. It additionally has a deterministic repository profile for broad orientation and a learned-memory ledger for verified discoveries. Agent-created findings require source ranges; their source hashes are checked on refresh and stale findings are never returned as current. `refresh` reconciles chunks by stable ID and source fingerprint: only changed evidence creates a new chunk revision, while task context includes the chunks relevant to its selected source paths.

Use `--json` on `compile`, `brain`, `analytics`, and `status` for automation. `brain --json` remains the stable machine-readable Brain object; human report flags do not change it. `diff` remains an alias for `status`.

## Analyze a nested application

The root repository and each standalone package are separate analysis scopes. For example:

```bash
node dist/cli.js compile examples/nextjs-demo
node dist/cli.js brain examples/nextjs-demo
```

Compiling the root does not falsely attribute the example application's routes to Compylar.

## Optional OpenAI enrichment

Compylar is deterministic by default. OpenAI enrichment is disabled unless the project explicitly opts in through `.compylar/config.json`; credentials never belong in that file.

```json
{
  "ai": {
    "provider": "openai",
    "mode": "optional",
    "model": "gpt-5.6",
    "timeoutMs": 30000
  }
}
```

When this optional mode is enabled, `OPENAI_API_KEY` supplies the credential through the environment or a secret manager. `OPENAI_MODEL` is not a Compylar configuration surface. If no key is available, enrichment reports `not-configured`; deterministic facts remain complete and authoritative. API errors are recorded as optional-enrichment failures and never replace repository facts.

Context-time AI is separate and opt-in with `context --ai`. It may rerank and summarize only deterministic candidates already found by Compylar. It cannot authorize edits or invent files, symbols, routes, or repository behavior. Agent harnesses should consume `context --json` or the structured retrieval interface, ask users clarifying questions, and obtain approval before making changes.

## Agent integration

The portable [Compylar skill](skills/compylar/SKILL.md) encodes the low-cost agent workflow: check freshness, refresh only when needed, retrieve task context, inspect source only for unresolved implementation detail, then refresh validated changes. Install it through your agent’s skill installer or from this repository; the root [AGENTS.md](AGENTS.md) provides the same concise workflow for agents working on Compylar itself.

For a deliberate project-scoped install, preview first and apply only after checking the destination:

```bash
# Codex: .agents/skills/compylar
compylar install-agent . --agent codex --scope project
compylar install-agent . --agent codex --scope project --apply

# Claude Code: .claude/skills/compylar
compylar install-agent . --agent claude --scope project --apply

# OpenCode: .agents/skills/compylar
compylar install-agent . --agent opencode --scope project --apply
```

This copies only the portable skill and refuses to overwrite an existing one. It never writes global agent configuration. See the [agent integration guide](docs/AGENT_INTEGRATION.md) for supported agent locations, setup behavior, and verification.

`context --ai` is a one-request opt-in for evidence-constrained reranking; it still requires an environment-provided key and never changes the Brain’s deterministic facts.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

Run the complete temporary-fixture demonstration with `pnpm demo`. It never changes the checked-in example repository.

Run `pnpm first-run` for the compact version: selected task context, the exact detected change, memory reuse, and elapsed work—without the full context document.

Run `pnpm benchmark` for a machine-readable measurement against the same temporary fixture. It reports the files selected for a concrete task, the detected change, memory chunks created/updated/reused/removed, and elapsed compile/context/status/refresh operations. It is a regression and demo measurement, not a universal performance claim; compare runs on the same machine and fixture.

The design and command contract are documented in [the compiler specification](docs/COMPYLAR_COMPILER_SPEC.md), [the CLI contract](docs/CLI_CONTRACT.md), [the Build Week MVP plan](docs/OPENAI_BUILD_WEEK_MVP_PLAN.md), [the Build Week submission runbook](docs/SUBMISSION_RUNBOOK.md), [the engineering roadmap](docs/ROADMAP.md), and [the research notes](docs/RESEARCH.md).
