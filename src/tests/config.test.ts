import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig, loadConfig } from "../config.js";
import { saveConfig } from "../storage.js";

describe("Compylar configuration", () => {
  it("keeps deterministic operation off by default", () => {
    expect(defaultConfig().ai).toMatchObject({
      provider: "openai",
      mode: "off",
      model: "gpt-5.6",
    });
  });

  it("loads optional AI behavior from project config without accepting credentials", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-config-"));
    await mkdir(path.join(root, ".compylar"));
    await writeFile(
      path.join(root, ".compylar", "config.json"),
      JSON.stringify({
        ai: {
          provider: "openai",
          mode: "optional",
          model: "configured-model",
          timeoutMs: 12_345,
          apiKey: "must-not-be-loaded",
        },
      }),
    );

    const config = await loadConfig(root);

    expect(config.ai).toEqual({
      provider: "openai",
      mode: "optional",
      model: "configured-model",
      timeoutMs: 12_345,
    });
    expect(JSON.stringify(config)).not.toContain("must-not-be-loaded");
  });

  it("writes an explicit non-secret AI configuration during initialization", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-init-"));
    await saveConfig(root);

    const config = JSON.parse(
      await readFile(path.join(root, ".compylar", "config.json"), "utf8"),
    );

    expect(config.ai).toMatchObject({ provider: "openai", mode: "off" });
    expect(JSON.stringify(config)).not.toMatch(/api[_-]?key/i);
  });
});
