import { RepositoryBrain, RepositoryCapability } from "./types.js";
import { typeScriptExtensions } from "./adapters/typescript.js";
import { goExtensions } from "./adapters/go.js";
import { pythonExtensions } from "./adapters/python.js";
import { rustExtensions } from "./adapters/rust.js";

/** Stable adapter seam: the core stores these normalized capability records. */
export type AnalyzerAdapter = {
  id: string;
  extensions?: string[];
  detect: (brain: Pick<RepositoryBrain, "files" | "routes">) => boolean;
  facts: string[];
};

export const adapters: AnalyzerAdapter[] = [
  { id: "typescript", extensions: typeScriptExtensions, detect: (brain) => brain.files.some((file) => typeScriptExtensions.includes(file.kind)), facts: ["definitions", "imports", "references", "tests"] },
  { id: "python", extensions: pythonExtensions, detect: (brain) => brain.files.some((file) => file.kind === "py"), facts: ["definitions", "imports", "references", "tests"] },
  { id: "go", extensions: goExtensions, detect: (brain) => brain.files.some((file) => file.kind === "go"), facts: ["definitions", "imports", "references", "tests", "routes"] },
  { id: "rust", extensions: rustExtensions, detect: (brain) => brain.files.some((file) => file.kind === "rs"), facts: ["definitions", "imports", "references", "tests", "routes"] },
  { id: "nextjs", detect: (brain) => brain.routes.some((route) => route.router.startsWith("next-")), facts: ["routes", "guards"] },
  { id: "fastapi", detect: (brain) => brain.routes.some((route) => route.router === "fastapi"), facts: ["routes"] },
];

export const supportedSourceExtensions = [...new Set(adapters.flatMap((adapter) => adapter.extensions ?? []))];

export function capabilitiesFor(brain: Pick<RepositoryBrain, "files" | "routes">): RepositoryCapability[] {
  return [
    { adapter: "structural", status: "active", facts: ["files", "hashes", "configuration", "documentation", "freshness"] },
    ...adapters.map((adapter) => ({ adapter: adapter.id, status: adapter.detect(brain) ? "active" as const : "not-detected" as const, facts: adapter.facts })),
  ];
}
