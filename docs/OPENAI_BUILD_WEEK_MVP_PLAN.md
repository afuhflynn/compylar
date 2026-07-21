# Compylar — OpenAI Build Week MVP Plan

## Product thesis

AI coding agents fail most often before they write code: they begin work without a reliable model of the repository. Larger prompts do not solve this. Repository understanding is structured, changes over time, and should outlive one agent session.

Compylar is persistent, evidence-backed repository memory. It compiles deterministic facts once, detects what changed, refreshes only affected knowledge, and supplies compact task context to any compatible coding agent.

> The context window is working memory. Compylar is long-term repository memory.

## Build Week objective

Deliver one convincing local workflow, not a platform demo:

1. Compile a repository into a Repository Brain.
2. Ask an agent for a task-specific context pack instead of broad exploration.
3. Change code, config, or documentation.
4. Detect staleness and refresh the Brain.
5. Show that unchanged memory chunks were retained and only affected chunks changed.

The reviewer should understand the value within 60 seconds: Compylar gives an agent durable understanding without repeatedly paying to rediscover a repository.

## North-star evidence

This MVP supports Product Vision point 17: agents should no longer start every task from zero.

We will measure that through observable proxies, not unsupported token claims:

- selected files and memory chunks per task;
- excluded repository areas per task;
- source analyses reused during refresh;
- changed and reused memory chunk counts;
- time for status, refresh, and context on the demo fixture.

`pnpm benchmark` emits these values as JSON from a temporary fixture copy. It is a reproducible regression measurement on one machine and fixture, not a claim that every repository will have the same latency or token reduction.

## Current capability baseline

- [x] TypeScript/JavaScript, package-aware compiler.
- [x] TypeScript AST facts: files, symbols, imports, exports, routes, packages, and dependency edges.
- [x] Persistent Brain snapshots in SQLite plus JSON and Markdown exports.
- [x] Bounded analysis, progress, checkpoints, and cache reuse.
- [x] Repository manifest status across source, docs, config, manifests, lockfiles, additions, and deletions.
- [x] `refresh` recompiles with unchanged-source reuse.
- [x] Typed memory chunks with stable IDs, evidence, source fingerprints, and targeted reconciliation.
- [x] Deterministic context packs with relevant memory chunks.
- [x] Portable Compylar agent skill and repository `AGENTS.md` workflow.
- [x] Deterministic default; optional OpenAI enrichment has non-secret provider/model/mode config.

## Scope boundaries

### In scope

- Local CLI and portable agent skill.
- TypeScript/JavaScript repositories and the included Next.js/workspace fixtures.
- Evidence-backed retrieval and explicit unknowns.
- Agent onboarding through skills and concise project guidance.
- A reproducible demo and transparent benchmark-style telemetry.

### Explicitly out of scope

- Hosted synchronization, teams, billing, or a web dashboard.
- A Compylar-owned coding agent.
- Multi-language semantic analysis beyond the current JavaScript/TypeScript scope.
- Full semantic dependency invalidation or background indexing.
- Secret storage, credential provisioning, or automatic AI spending.

## Agent contract

Compylar is not an authority to modify code. It gives agents a low-cost, verifiable workflow:

1. Check Brain freshness.
2. Compile if missing; refresh if stale.
3. Retrieve task context and memory chunks.
4. Read source only for required implementation detail or an explicit unknown.
5. Make and validate the change.
6. Refresh repository memory after meaningful validated changes.

The CLI owns repository writes; the coding agent and user retain approval and mutation control.

## AI and credential policy

Deterministic analysis is complete without an API key. `.compylar/config.json` may opt into OpenAI enrichment with a provider, mode, model, and timeout. Credentials are supplied only through an environment variable or secret manager.

The submission must explain both:

- how Codex was used to build and validate Compylar; and
- if optional enrichment is demonstrated, how it is clearly constrained by deterministic evidence.

The live rules are verified in [the submission runbook](SUBMISSION_RUNBOOK.md). Recheck them immediately before submitting, because Devpost may update the challenge page.

The ready-to-paste description and under-three-minute narration live in [the Devpost submission draft](DEVPOST_SUBMISSION_DRAFT.md).

## Demo script (under three minutes)

Run `pnpm demo` to execute this sequence against a temporary copy of the Next.js fixture. It leaves the checked-in example untouched.

### 0:00–0:20 — problem

Show a new repository and the task: “Add authentication to the dashboard.” Explain that a normal coding agent would first rediscover the repository.

### 0:20–0:55 — compile once

Run `compylar compile examples/nextjs-demo --no-ai`. Show the Brain summary: packages, routes, dependencies, and memory chunk count.

### 0:55–1:25 — retrieve, do not rediscover

Run `compylar context "add authentication to the dashboard" examples/nextjs-demo --json`. Show selected evidence, reusable memory chunks, exclusions, and explicit unknowns.

### 1:25–2:00 — change and detect

Make one small, visible source or configuration change. Run `compylar status examples/nextjs-demo` and show the exact changed path plus stale state.

### 2:00–2:35 — refresh only what changed

Run `compylar refresh examples/nextjs-demo --no-ai`, then inspect `compylar brain examples/nextjs-demo --json`. Show the memory change entries: the changed module chunk updates while unrelated chunks are reused.

### 2:35–3:00 — close

“Compylar makes repository understanding persistent, queryable, and cheap to keep current. The agent starts with evidence instead of assumptions.”

## Submission checklist

- [x] Verify Build Week rules, Developer Tools category, deadline, and evidence requirements from official sources.
- [ ] Run `pnpm typecheck`, `pnpm test`, and `pnpm build` on the submission revision.
- [ ] Run the demo from a clean state and capture exact commands/output.
- [ ] Record a video under the event limit.
- [ ] Publish a README with install, no-key deterministic workflow, optional AI policy, and agent-skill setup.
- [ ] Include the public repository and required Codex session/feedback evidence.
- [ ] Write a short description centered on durable repository memory and targeted refresh.

## Definition of done

The MVP is done when a reviewer can independently reproduce the compile → context → change → status → refresh flow and see evidence that Compylar avoided full cognitive rediscovery while preserving correctness boundaries.
