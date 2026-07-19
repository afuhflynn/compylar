import { access, cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const supportedAgents = ["codex", "claude", "opencode"] as const;
export type SupportedAgent = (typeof supportedAgents)[number];
export type AgentInstallScope = "project";

export type AgentInstallPlan = {
  agent: SupportedAgent;
  scope: AgentInstallScope;
  root: string;
  source: string;
  destination: string;
  state: "ready" | "conflict";
  mcp: {
    configured: false;
    guidance: string;
  };
};

type CreateAgentInstallPlanOptions = {
  root: string;
  agent: SupportedAgent;
  scope: AgentInstallScope;
  sourceRoot?: string;
};

const packageRoot = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const skillDestination = (root: string, agent: SupportedAgent) =>
  agent === "claude"
    ? path.join(root, ".claude", "skills", "compylar")
    : path.join(root, ".agents", "skills", "compylar");

const mcpGuidance = (agent: SupportedAgent) =>
  agent === "codex"
    ? "MCP is separate and unchanged. To configure project-scoped MCP, add a [mcp_servers.compylar] table to .codex/config.toml with command = \"compylar\", args = [\"mcp\", \".\"], and cwd set to this repository."
    : agent === "claude"
      ? "MCP is separate and unchanged. To configure team-shared MCP, run: claude mcp add --transport stdio --scope project compylar -- compylar mcp . Then review and approve the project server in Claude Code."
      : "MCP is separate and unchanged. To configure OpenCode, add a local compylar server to the repository opencode.json with command [\"compylar\", \"mcp\", \".\"] and cwd set to this repository.";

async function pathExists(target: string) {
  return access(target).then(
    () => true,
    () => false,
  );
}

export async function createAgentInstallPlan(
  options: CreateAgentInstallPlanOptions,
): Promise<AgentInstallPlan> {
  const root = path.resolve(options.root);
  const source = path.join(
    options.sourceRoot ?? packageRoot(),
    "skills",
    "compylar",
  );
  if (!(await pathExists(source))) {
    throw new Error(`Bundled Compylar skill is missing from ${source}.`);
  }
  const destination = skillDestination(root, options.agent);
  return {
    agent: options.agent,
    scope: options.scope,
    root,
    source,
    destination,
    state: (await pathExists(destination)) ? "conflict" : "ready",
    mcp: { configured: false, guidance: mcpGuidance(options.agent) },
  };
}

export async function applyAgentInstall(plan: AgentInstallPlan) {
  if (plan.state === "conflict" || (await pathExists(plan.destination))) {
    throw new Error(
      `Agent skill already exists at ${plan.destination}. Refusing to overwrite it; remove or rename it yourself before applying this install.`,
    );
  }
  await mkdir(path.dirname(plan.destination), { recursive: true });
  await cp(plan.source, plan.destination, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  return { ...plan, state: "installed" as const };
}
