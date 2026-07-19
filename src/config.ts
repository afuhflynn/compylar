import fs from "node:fs/promises";
import path from "node:path";
import { CompileLimits } from "./types.js";

export const DEFAULT_LIMITS: CompileLimits = {
  maxFiles: 25_000,
  maxFileSize: 1_048_576,
  maxTotalBytes: 262_144_000,
};
export type CompileConfig = CompileLimits & {
  concurrency: number;
  timeoutMs: number;
  ignore: string[];
  ai: AiConfig;
};
export type AiConfig = {
  provider: "openai";
  mode: "off" | "optional";
  model: string;
  timeoutMs: number;
};
export const defaultConfig = (): CompileConfig => ({
  ...DEFAULT_LIMITS,
  concurrency: 4,
  timeoutMs: 30_000,
  ai: {
    provider: "openai",
    mode: "off",
    model: "gpt-5.6",
    timeoutMs: 30_000,
  },
  ignore: [
    "node_modules/**",
    ".git/**",
    ".compylar/**",
    "dist/**",
    "build/**",
    ".next/**",
    "coverage/**",
    ".turbo/**",
    ".cache/**",
    "vendor/**",
  ],
});
export async function loadConfig(root: string): Promise<CompileConfig> {
  const config = defaultConfig();
  try {
    const raw = JSON.parse(
      await fs.readFile(path.join(root, ".compylar", "config.json"), "utf8"),
    );
    const rawAi = raw && typeof raw.ai === "object" && raw.ai !== null
      ? raw.ai as Record<string, unknown>
      : {};
    const ai: AiConfig = {
      provider: rawAi.provider === "openai" ? "openai" : config.ai.provider,
      mode: rawAi.mode === "optional" || rawAi.mode === "off" ? rawAi.mode : config.ai.mode,
      model: typeof rawAi.model === "string" && rawAi.model.trim() ? rawAi.model.trim() : config.ai.model,
      timeoutMs: typeof rawAi.timeoutMs === "number" && rawAi.timeoutMs > 0
        ? rawAi.timeoutMs
        : config.ai.timeoutMs,
    };
    return {
      ...config,
      ...raw,
      ai,
      ignore: Array.isArray(raw.ignore)
        ? [...new Set([...config.ignore, ...raw.ignore])]
        : config.ignore,
    };
  } catch {
    return config;
  }
}
