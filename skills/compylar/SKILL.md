---
name: compylar
description: Use Compylar to establish, refresh, and retrieve persistent repository understanding before working in an unfamiliar codebase, answering a codebase question, planning a change, debugging, or updating knowledge after verified edits. Prefer it over broad file exploration when a Compylar CLI or MCP server is available.
---

# Compylar repository memory

Use the repository Brain as evidence-backed working memory. Do not treat it as permission to edit or as a substitute for required implementation detail.

## Before work

1. Check `compylar_status` through MCP, or run `compylar status .`.
2. If no Brain exists, run `compylar compile . --no-ai`.
3. If stale, run `compylar refresh . --no-ai`. Do not answer from stale memory.
4. Retrieve `compylar_context` for the concrete task. Use `compylar_memory` for a compact fact lookup when a task names a module, route, package, or dependency.

## Work with minimal context

- Start from returned memory chunks, source paths, evidence, and selected files.
- Read source only for details that memory cannot prove, to implement a change, or to resolve an explicit unknown.
- State uncertainty rather than inventing behavior. Ask a focused clarification question when the context result requires one.
- For a framework, library, or platform decision that may have changed, consult official documentation before implementing.

## After work

1. Run the relevant meaningful tests and checks.
2. Run `compylar status .`.
3. If repository facts changed, run `compylar refresh . --no-ai` after validation. This updates only memory chunks whose source evidence changed.

## Boundaries

- Deterministic facts and their evidence are authoritative. Optional AI interpretation is not.
- Compylar MCP tools are read-only. Use the CLI for compile or refresh.
- No OpenAI API key is required for compilation, status, refresh, memory, or context. Opt into AI only when it adds clear value.
