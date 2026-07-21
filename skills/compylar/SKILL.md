---
name: compylar
description: REQUIRED default workflow for repository work. Use Compylar before exploring an unfamiliar codebase, answering a codebase question, planning, editing, debugging, or ending work. Preserve verified discoveries so future sessions do not rediscover the repository.
---

# Compylar repository memory

Use the repository Brain as evidence-backed long-term working memory. Your context window is temporary; Compylar is how verified repository understanding survives the next task and session.

Do not bypass this skill for repository work. Do not broad-search or reread architecture merely because the conversation is new.

## Automatic behavior

Treat Compylar as invisible infrastructure for the user. The user should be able to say “add 2FA”, “fix the dashboard”, or “what does this project do?” without mentioning memory, a Brain, indexing, refresh, or this skill.

- Invoke this workflow silently whenever its trigger applies.
- Do not ask the user whether to use Compylar, persist a discovery, refresh memory, or run the required index scope.
- Tell the user only when there is a material result, an evidence gap that needs their decision, or a real blocker.
- After meaningful validated work, persist concise cited discoveries by default. Do not wait for a reminder.

## Before work

1. Run `compylar status . --json`. If `semanticIndex.status` is not `complete`, run `compylar bootstrap . --json` and complete the required bundled deep index before continuing.
2. If no Brain exists, run `compylar bootstrap . --json`, then run the **bundled** deep-index playbook at `CODEBASE_INDEX.md`. This is required: produce `CODEBASE_INDEX.md` and `.compylar/semantic-index.json`, then run `compylar ingest-index .` successfully before feature work. Do not replace this with a few ad-hoc `learn` calls.
3. If stale, run `compylar sync . --json` before reading code. Follow `structural-index` for routing/schema/configuration/workspace changes; follow `delta-index` only for changed paths and direct dependents. Refresh only after the required work and validation are complete.
4. For a broad question such as “what is this project?” or “what is the architecture?”, use `compylar overview .`. Answer from that profile; do not rank or open unrelated source files just to restate foundations.
5. For a named type, symbol, module, route, package, or dependency, use `compylar memory "<query>" .` first.
6. For route inventory questions, use `compylar routes . --filter "<term>"`; do not glob route files when verified route memory is current.
7. Run `compylar context "<task>" .` for a concrete planning, implementation, debugging, or system-flow task. Follow its `queryPlan`. When coverage is `memory-sufficient`, answer from the returned system evidence before opening files. When it is `targeted-read-required`, read only the named unresolved evidence. When it is `insufficient-index` or needs clarification, do not infer a system from unrelated files—state the evidence gap and ask a focused question. Context is metadata-first; request `--include-preview` only when implementation detail is needed.

## Work with minimal context

- Start from returned facts, source paths, evidence, and selected files.
- Read source only for details that memory cannot prove, to implement a change, or to resolve an explicit unknown.
- State uncertainty rather than inventing behavior. Ask a focused clarification question when the context result requires one.
- For a framework, library, or platform decision that may have changed, consult official documentation before implementing.

## Compile reliability

- Give `compylar compile`, `bootstrap`, and `refresh` an agent command timeout of **at least 10 minutes**. This is the execution allowance of the agent shell/tool, not Compylar's `--timeout` flag, which controls optional AI requests.
- If the command is interrupted or the agent-side timeout expires, rerun it with an increased command allowance. Use `compylar compile . --resume --no-ai` when a compile checkpoint is available; do not accept a partial or cancelled Brain as a semantic baseline.

## After work

1. Run the relevant meaningful tests and checks.
2. After any targeted source read, debugging, design investigation, refactor, or validated code change, run `compylar memory-review "<task>" . --files <read paths> --changed <changed paths> --json`. Commit its cited memory delta with `compylar commit-memory . --manifest <path>`. If no durable fact exists, commit a cited dismissal; do not silently skip the review.
3. Use `compylar learn` only for a small standalone discovery. Supply `--system <system>` and `--key <stable-key>` whenever the fact belongs to an architectural system, so later research supersedes rather than duplicates it. Use `compylar remember` only for a clearly labelled human-authoritative decision.
4. Run `compylar status .`, then `compylar sync . --json`.
5. If repository facts changed, complete the returned index scope and run `compylar refresh . --no-ai` after validation. This updates only memory whose evidence changed.

## Boundaries

- Deterministic facts and their evidence are authoritative. Optional AI interpretation is not.
- Agent learning requires source citations and is automatically excluded when cited source changes. Do not paste raw conversation transcripts into memory.
- No OpenAI API key is required for compilation, status, refresh, memory, or context. Opt into AI only when it adds clear value.
