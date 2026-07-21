# Devpost submission draft

## Title

Compylar — persistent repository memory for coding agents

## Track

Developer Tools

## Tagline

Compile a codebase once, retrieve only the evidence an agent needs, and refresh memory precisely when the repository changes.

## Description

Coding agents are capable of writing strong code, but they often begin changes before they understand the repository. That makes them rediscover the same architecture, dependencies, and conventions every session—and it encourages confident guesses.

Compylar is local, persistent repository memory for coding agents. It compiles a TypeScript or JavaScript repository into an evidence-backed Repository Brain: package boundaries, source facts, symbols, routes, dependency edges, tracked repository files, and reusable memory chunks. An agent then asks for a compact, task-specific context pack instead of loading broad folders into its context window.

The key workflow is freshness-first. Compylar detects additions, changes, and deletions across source, documentation, configuration, manifests, and lockfiles. When knowledge is stale, `refresh` reuses unchanged analysis and reconciles memory by stable IDs and source fingerprints. It shows exactly which chunks changed and which were reused.

Compylar’s deterministic core works without an API key. Optional AI enrichment is constrained to verified candidates and cannot invent repository facts. The CLI, portable agent skill, and concise project guidance give agents a practical contract: check freshness, retrieve evidence, read source only when needed, validate changes, then refresh memory.

Built with Codex and GPT-5.6 during OpenAI Build Week. The submission evidence includes the primary Codex `/feedback` Session ID, dated repository history, and the demo below.

## Judge testing instructions

```bash
npx -y compylar@0.1.0 demo

# Optional source-checkout verification
pnpm install
pnpm build
pnpm benchmark
```

`npx -y compylar@0.1.0 demo` runs the packaged CLI against a temporary fixture copy and proves compile → context → changed-path detection → refresh, with no clone or rebuild required. `pnpm benchmark` is optional source-checkout verification. No OpenAI API key is required.

## Demo video narration (under three minutes)

### 0:00–0:20 — the problem

“Coding agents can write code quickly, but they often start before they understand a repository. Each session pays again to rediscover the same codebase—and wrong assumptions compound into wrong changes.”

Show the fixture and task: “Add authentication to the dashboard.”

### 0:20–0:50 — compile once

Run `npx -y compylar@0.1.0 demo` or `compylar compile examples/nextjs-demo --no-ai`. Explain that Compylar produces deterministic, evidence-backed repository memory rather than a one-off summary.

### 0:50–1:25 — retrieve, do not rediscover

Show `compylar context "add authentication to the dashboard" examples/nextjs-demo --json`. Point out the selected files, relevant memory chunks, excluded context, and explicit unknowns.

### 1:25–2:00 — detect the change

Make the small dashboard change included in the demo. Run `compylar status` and show the exact changed path.

### 2:00–2:35 — refresh precisely

Run `compylar refresh --no-ai`. Highlight one updated module chunk and the unchanged chunks reused without re-analysis.

### 2:35–3:00 — close

“Compylar makes codebase understanding persistent, queryable, and cheap to keep current. Agents start from evidence instead of rediscovering a repository from zero.”

State briefly how Codex and GPT-5.6 were used to build and validate Compylar, then show the `/feedback` Session ID in the submission form rather than in the video.

## Submission-form placeholders

- Repository URL: `TODO — public URL or private repository shared with both judge email addresses`
- YouTube video URL: `TODO`
- Codex `/feedback` Session ID: `TODO — primary build thread`
