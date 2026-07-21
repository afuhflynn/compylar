import { access, cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
  comparison?: "identical" | "modified";
};
export type AgentSetupPlan = AgentInstallPlan & {
  instruction: { destination: string; content: string; state: "ready" | "conflict" };
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

const instructionDestination = (root: string, agent: SupportedAgent) =>
  agent === "claude" ? path.join(root, "CLAUDE.md") : agent === "opencode" ? path.join(root, ".opencode", "AGENTS.md") : path.join(root, "AGENTS.md");
const instructionContent = () => `# Compylar repository memory\n\nFor repository questions or repository work, use the Compylar skill first. If no Brain exists, bootstrap it, complete the bundled deep codebase index, and ingest its semantic manifest before feature work. Give bootstrap, compile, and refresh at least a 10-minute agent command allowance; if interrupted, retry with a larger allowance. Then use overview, memory, or context before broad source reads; read source only for evidence gaps; after validated deeper work, record cited learning and refresh the Brain.\n`;

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
  const exists = await pathExists(destination);
  let comparison: AgentInstallPlan["comparison"];
  if (exists) {
    const [sourceSkill, destinationSkill] = await Promise.all([
      readFile(path.join(source, "SKILL.md"), "utf8").catch(() => ""),
      readFile(path.join(destination, "SKILL.md"), "utf8").catch(() => ""),
    ]);
    comparison = sourceSkill === destinationSkill ? "identical" : "modified";
  }
  return {
    agent: options.agent,
    scope: options.scope,
    root,
    source,
    destination,
    state: exists ? "conflict" : "ready",
    comparison,
  };
}

export async function applyAgentInstall(plan: AgentInstallPlan, replace = false) {
  if ((plan.state === "conflict" || (await pathExists(plan.destination))) && !replace) {
    throw new Error(
      `Agent skill already exists at ${plan.destination}. Refusing to overwrite it; remove or rename it yourself before applying this install.`,
    );
  }
  let backupPath: string | undefined;
  if (await pathExists(plan.destination)) {
    backupPath = `${plan.destination}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await rename(plan.destination, backupPath);
  }
  await mkdir(path.dirname(plan.destination), { recursive: true });
  await cp(plan.source, plan.destination, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  return { ...plan, state: "installed" as const, backupPath };
}

/** Installs both layers required for proactive use: the detailed skill and a short always-on trigger. */
export async function createAgentSetupPlan(options: CreateAgentInstallPlanOptions): Promise<AgentSetupPlan> {
  const skill = await createAgentInstallPlan(options);
  const destination = instructionDestination(skill.root, skill.agent);
  return { ...skill, instruction: { destination, content: instructionContent(), state: await pathExists(destination) ? "conflict" : "ready" } };
}

export async function applyAgentSetup(plan: AgentSetupPlan, replaceSkill = false) {
  if (plan.instruction.state === "conflict" || await pathExists(plan.instruction.destination)) {
    throw new Error(`Agent instruction already exists at ${plan.instruction.destination}. Refusing to overwrite it; merge the displayed Compylar trigger manually.`);
  }
  const skill = await applyAgentInstall(plan, replaceSkill);
  await mkdir(path.dirname(plan.instruction.destination), { recursive: true });
  await writeFile(plan.instruction.destination, plan.instruction.content);
  return { ...skill, instruction: { ...plan.instruction, state: "installed" as const } };
}
