# Compylar

Compylar is a local CLI for giving AI coding agents a durable, evidence-backed understanding of a repository. Instead of making the agent rediscover the same structure on every session, it builds a small repository brain that can be reused for future work.

This repository contains the implementation of that workflow: a compiler for repository facts, a local brain stored on disk, and a set of commands for status checks, task context, and refreshes.

## What it does

Compylar is designed around a simple idea:

- analyze a JavaScript or TypeScript repository
- capture facts with source evidence
- detect when that knowledge is stale
- produce targeted context for a coding task
- work with an agent without requiring a full repository re-scan every time

The implementation is deterministic by default. It does not depend on an OpenAI key to compile facts or generate context.

## Quick start

Compylar is published on npm, so you can run it directly with `npx` or install it globally.

Check that the CLI works:

```bash
npx -y compylar@0.1.1 --help
```

To use it in a real repository, install Compylar for the agent you want to work with:

```bash
cd /path/to/your-repository
```

For Codex:

```bash
npx -y compylar@0.1.1 setup-agent . --agent codex --scope project --apply
```

For Claude Code:

```bash
npx -y compylar@0.1.1 setup-agent . --agent claude --scope project --apply
```

For OpenCode:

```bash
npx -y compylar@0.1.1 setup-agent . --agent opencode --scope project --apply
```

This installs the Compylar skill and a short project instruction file so the agent knows to use repository memory before broad source-code reads.

## Supported platforms

Compylar runs locally through Node.js and npm:

- Node.js 22.5+
- macOS
- Linux
- Windows through npm launchers

Agent setup currently supports:

- Codex
- Claude Code
- OpenCode

No OpenAI API key is required for the core workflow.

## How to test with a coding agent

After running `setup-agent`, start your coding agent inside the same repository.

For Codex:

```bash
cd /path/to/your-repository
codex
```

Then ask:

```text
Index this codebase
```

The first index can take some time. Compylar creates a deterministic repository brain, and the installed agent workflow guides the agent through a deeper source-cited codebase index and memory ingest.

After indexing finishes, start a new agent session in the same repository and ask normal questions such as:

1. What does this project do?
2. How does authentication work?
3. Explain the main architecture.

Expected behavior: the agent should use Compylar memory first instead of grepping or reading broad sets of files just to rediscover foundational knowledge.

Then try a real feature request:

1. Add an activity timeline to the dashboard using the existing project patterns.

Expected behavior: the agent should retrieve task-specific Compylar context, read only targeted files when necessary, implement the change, run validation, and update Compylar memory afterward so future sessions do not repeat the same discovery work.

If you want to try the built-in demo instead of wiring up a real repository, run:

```bash
npx -y compylar@0.1.1 demo
```

## Core workflow

The main flow is straightforward:

```bash
# compile repository facts into a local brain
compylar compile .

# inspect the current state
compylar brain .

# see whether the repository changed since the last compile
compylar status .

# create task-specific context for an agent
compylar context "add authentication to the dashboard" .
```

A few important details:

- `compile` creates the repository brain and stores it under `.compylar/`
- `status` compares the current repository to the last successful baseline
- `context` returns relevant evidence and metadata without flooding the agent with raw source
- `refresh` and `sync` are used when the repository has changed and the stored knowledge needs to be updated

## Requirements

- Node.js 22.5 or newer
- pnpm

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

Useful developer commands:

```bash
pnpm demo
pnpm first-run
pnpm benchmark
```

## Notes on AI usage

Compylar is designed to be useful to AI agents, but the repository itself is not an AI-only product. The core behavior is based on deterministic repository analysis, with optional AI enrichment available only when explicitly enabled by the user.

If you are using Compylar in a real project, the most important thing is to keep the README and project description grounded in what the code actually does. That is the difference between a polished project page and a generic generated one.

## Project structure

The repository includes:

- the CLI implementation in the `src/` directory
- example applications under `examples/`
- agent integration assets in `skills/` and `AGENTS.md`
- design and contract documents in `docs/`
