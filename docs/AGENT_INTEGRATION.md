# Compylar agent integration

Compylar has two complementary integration surfaces:

1. A portable skill tells an agent when to check freshness, retrieve memory, and refresh validated changes.
2. A local read-only MCP server gives the agent structured Brain, status, memory, and task-context queries.

Install the skill first. Add MCP only after reviewing the exact configuration. Neither surface needs an OpenAI API key for deterministic operation.

## Safe install contract

`compylar install-agent` is intentionally conservative:

- It requires an explicit `--agent` and supports only `--scope project`.
- It previews by default; `--apply` is required to copy files.
- It refuses to overwrite an existing skill.
- It never writes a home-directory configuration, an `AGENTS.md`/`CLAUDE.md`, or MCP configuration.

The project scope is deliberate: it is reviewable in source control and does not unexpectedly affect unrelated repositories. User/global installation and automatic agent detection are deferred until their paths and rollback behavior have fixture coverage.

## Codex

From the repository root:

```bash
compylar install-agent . --agent codex --scope project
compylar install-agent . --agent codex --scope project --apply
```

This copies the skill to `.agents/skills/compylar/`, the repository skill location Codex scans. The skill's description is designed to trigger for unfamiliar repositories, codebase questions, planning, debugging, and post-change memory updates.

To add the optional project-scoped MCP server, review and merge this into `.codex/config.toml`; replace the absolute path with the repository root:

```toml
[mcp_servers.compylar]
command = "compylar"
args = ["mcp", "."]
cwd = "/absolute/path/to/repository"
startup_timeout_sec = 10
tool_timeout_sec = 60
```

Alternatively, `codex mcp add compylar -- compylar mcp .` adds a user-level CLI configuration. Compylar does not run that command because a user-level setting affects more than one repository.

## Claude Code

From the repository root:

```bash
compylar install-agent . --agent claude --scope project
compylar install-agent . --agent claude --scope project --apply
```

This copies the skill to `.claude/skills/compylar/`, where Claude Code discovers project skills. Then, if the team wants the read-only MCP tools, add its reviewable project configuration using Claude Code's own CLI:

```bash
claude mcp add --transport stdio --scope project compylar -- compylar mcp .
```

Claude Code writes the shared entry to `.mcp.json` and prompts each user to approve a project-scoped server. That approval is intentional: a cloned repository must not silently enable a local process.

## OpenCode

From the repository root:

```bash
compylar install-agent . --agent opencode --scope project
compylar install-agent . --agent opencode --scope project --apply
```

This copies the portable skill to `.agents/skills/compylar/`, a project skill location OpenCode discovers. To add the optional local MCP server, review and merge this into `opencode.json` at the repository root; replace the absolute path with the repository root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "compylar": {
      "type": "local",
      "command": ["compylar", "mcp", "."],
      "cwd": "/absolute/path/to/repository",
      "enabled": true
    }
  }
}
```

OpenCode gives the model access to configured MCP tools. Keep Compylar's read-only tool set enabled only when you want it available in the current agent workflow.

## Runtime workflow

The skill guides agents through this sequence:

```text
status → compile if missing / refresh if stale → context or memory → targeted source reads → meaningful tests → status → refresh
```

MCP is read-only. `compile` and `refresh` remain explicit CLI actions because they update repository state. Source files are still read when implementation needs details that the evidence-backed memory cannot prove.

## Verification

After setup, start a fresh agent session and ask for a concrete task such as “explain the authentication flow.” The agent should use Compylar status/context/memory first, state any unknowns, and avoid broad repository discovery when a current Brain exists.

Run `compylar doctor .` to confirm local baseline prerequisites, then `compylar mcp-health .` to verify Compylar's protocol responses and tool discovery. The health check does not connect an external agent; use your agent's MCP panel or command to verify its separate configuration and project-trust approval.
