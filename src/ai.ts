import OpenAI from "openai";
import { AiConfig, defaultConfig } from "./config.js";
import { ProgressReporter } from "./progress.js";
import { ContextPack, RepositoryBrain } from "./types.js";

export async function enrichArchitecture(
  brain: RepositoryBrain,
  config: AiConfig = defaultConfig().ai,
  progress?: ProgressReporter,
): Promise<RepositoryBrain["ai"]> {
  if (config.mode === "off") return { status: "not-configured" };
  if (!process.env.OPENAI_API_KEY) return { status: "not-configured" };
  const model = config.model;
  progress?.({
    phase: "ai",
    current: 0,
    total: 1,
    message: "requesting architecture interpretation",
  });
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: config.timeoutMs,
    });
    const response = await client.responses.create({
      model,
      input: `You are summarizing verified repository facts. Do not invent facts. Return exactly 3 concise sentences describing architecture, package boundaries, and the most important implementation constraint. Facts:\n${JSON.stringify({ repo: brain.repo, packages: brain.packages, routes: brain.routes, diagnostics: brain.diagnostics })}`,
    });
    progress?.({ phase: "ai", current: 1, total: 1, message: "completed" });
    return { status: "completed", model, summary: response.output_text.trim() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    progress?.({ phase: "ai", current: 1, total: 1, message });
    return {
      status: message.toLowerCase().includes("timeout")
        ? "timed-out"
        : "failed",
      model,
      error: message,
    };
  }
}

export async function enrichContext(
  pack: ContextPack,
  config: AiConfig = defaultConfig().ai,
): Promise<ContextPack> {
  if (config.mode === "off") {
    return { ...pack, ai: { status: "not-configured" } };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { ...pack, ai: { status: "not-configured" } };
  }
  const model = config.model;
  const candidates = pack.selectedFiles.map((file) => ({
    path: file.path,
    packageName: file.packageName,
    score: file.score,
    reason: file.reason,
    symbols: file.symbols,
    preview: file.preview,
  }));
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: config.timeoutMs });
    const response = await client.responses.create({
      model,
      input: `You are a repository-context reranker. Use only the supplied candidates and verified facts. Do not invent files, symbols, routes, behavior, or fixes. Return JSON only with this shape: {"selectedPaths": string[], "claims": [{"text": string, "evidencePaths": string[]}]}. The selectedPaths and every evidencePaths item must be a subset of candidate paths. Every claim must be concise, evidence-grounded, and state uncertainty when appropriate. Task: ${pack.task}\nIntent: ${pack.intent}\nCandidates:\n${JSON.stringify(candidates)}`,
    });
    const raw = response.output_text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(raw) as { selectedPaths?: unknown; claims?: unknown };
    const paths = Array.isArray(parsed.selectedPaths) && parsed.selectedPaths.every((item): item is string => typeof item === "string")
      ? parsed.selectedPaths
      : [];
    const allowed = new Set(pack.selectedFiles.map((file) => file.path));
    const claims = Array.isArray(parsed.claims) ? parsed.claims.filter((claim): claim is { text: string; evidencePaths: string[] } => {
      if (!claim || typeof claim !== "object") return false;
      const value = claim as { text?: unknown; evidencePaths?: unknown };
      return typeof value.text === "string" && Boolean(value.text.trim()) && Array.isArray(value.evidencePaths) && value.evidencePaths.length > 0 && value.evidencePaths.every((file): file is string => typeof file === "string" && allowed.has(file));
    }) : [];
    if (!paths.length || paths.some((file) => !allowed.has(file)) || claims.length !== (Array.isArray(parsed.claims) ? parsed.claims.length : 0)) {
      return { ...pack, ai: { status: "invalid", model, error: "The AI response did not satisfy the evidence contract." } };
    }
    const selected = paths.map((file) => pack.selectedFiles.find((candidate) => candidate.path === file)).filter((file): file is ContextPack["selectedFiles"][number] => Boolean(file));
    return {
      ...pack,
      retrievalMode: "ai-assisted",
      confidence: "high",
      selectedFiles: selected,
      ai: {
        status: "completed",
        model,
        interpretation: claims.map((claim) => `${claim.text.trim()} [evidence: ${claim.evidencePaths.join(", ")}]`).join(" "),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...pack,
      ai: {
        status: message.toLowerCase().includes("timeout") ? "timed-out" : "failed",
        model,
        error: message,
      },
    };
  }
}
