# Compylar agent integration

Compylar integrates through a portable skill and a concise always-on project
instruction. The instruction solves the discovery problem: it tells an agent to
load the detailed skill before it opens files for repository work.

## Recommended setup

From the target repository, preview the changes first and then apply them:

```bash
compylar setup-agent . --agent codex
compylar setup-agent . --agent codex --apply
```

`setup-agent` installs the portable skill and a short project trigger:

| Agent | Skill location | Trigger file |
| --- | --- | --- |
| Codex | `.agents/skills/compylar/` | `AGENTS.md` |
| Claude Code | `.claude/skills/compylar/` | `CLAUDE.md` |
| OpenCode | `.agents/skills/compylar/` | `.opencode/AGENTS.md` |

Use `--agent claude` or `--agent opencode` for those agents. The command is
project-scoped, previews by default, and refuses to overwrite either an existing
skill or an existing instruction file. When a project already has guidance,
merge the displayed Compylar trigger manually.

`install-agent` remains available for teams that intentionally want only the
portable skill and will manage their project instruction file themselves.

## First-time repository behavior

Users should use ordinary prompts, such as “what does this project do?” or
“implement two-factor authentication.” They should not have to ask the agent to
index, remember, refresh, or use a Brain.

When no semantic Brain exists, the installed skill requires this sequence before
feature work:

```text
bootstrap → deterministic compile → bundled codebase index → cited manifest ingest
```

Give `bootstrap`, `compile`, and `refresh` at least ten minutes of agent command
time. If a command is interrupted, retry with a larger allowance and use
`compylar compile . --resume --no-ai` when a checkpoint exists.

With a current Brain, an agent uses `status`, `overview`, `memory`, or `context`
before broad source reads. It reads source only for a named evidence gap or an
exact edit range. After validated deeper work or meaningful changes, it records
cited reusable findings, runs `sync`, and refreshes affected memory.

## Verification

Start a fresh agent session and ask a broad question, then a concrete task. A
correctly configured agent starts from Compylar evidence, surfaces genuine
unknowns, avoids broad rediscovery, and preserves validated discoveries for the
next session.

Compylar does not claim to bypass an agent's permission or command-approval
policy. The agent still decides whether it is allowed to run a command or edit a
file.
