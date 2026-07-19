import { access, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyAgentInstall,
  createAgentInstallPlan,
} from "../agent-install.js";

async function fixtureSkill(root: string) {
  const source = path.join(root, "source", "skills", "compylar");
  await mkdir(path.join(source, "agents"), { recursive: true });
  await writeFile(path.join(source, "SKILL.md"), "# Compylar\n");
  await writeFile(path.join(source, "agents", "openai.yaml"), "interface: {}\n");
  return path.join(root, "source");
}

describe("agent installation", () => {
  it("previews a Codex project skill install without changing the repository", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-agent-"));
    const sourceRoot = await fixtureSkill(root);

    const plan = await createAgentInstallPlan({
      root,
      agent: "codex",
      scope: "project",
      sourceRoot,
    });

    expect(plan).toMatchObject({
      agent: "codex",
      scope: "project",
      state: "ready",
      destination: path.join(root, ".agents", "skills", "compylar"),
    });
    await expect(access(plan.destination)).rejects.toThrow();
  });

  it("installs the portable skill only after the plan is explicitly applied", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-agent-"));
    const sourceRoot = await fixtureSkill(root);
    const plan = await createAgentInstallPlan({
      root,
      agent: "claude",
      scope: "project",
      sourceRoot,
    });

    const applied = await applyAgentInstall(plan);

    expect(applied.state).toBe("installed");
    expect(await access(path.join(plan.destination, "SKILL.md"))).toBeUndefined();
    expect(await access(path.join(plan.destination, "agents", "openai.yaml"))).toBeUndefined();
  });

  it("uses the shared agent-skill location for an OpenCode project", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-agent-"));
    const sourceRoot = await fixtureSkill(root);

    const plan = await createAgentInstallPlan({
      root,
      agent: "opencode",
      scope: "project",
      sourceRoot,
    });

    expect(plan).toMatchObject({
      agent: "opencode",
      destination: path.join(root, ".agents", "skills", "compylar"),
    });
    expect(plan.mcp.guidance).toMatch(/opencode\.json/i);
  });

  it("refuses to overwrite an existing agent skill", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-agent-"));
    const sourceRoot = await fixtureSkill(root);
    const destination = path.join(root, ".agents", "skills", "compylar");
    await mkdir(destination, { recursive: true });

    const plan = await createAgentInstallPlan({
      root,
      agent: "codex",
      scope: "project",
      sourceRoot,
    });

    expect(plan.state).toBe("conflict");
    await expect(applyAgentInstall(plan)).rejects.toThrow(/already exists/i);
  });
});
