import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { Project, SourceFile, SyntaxKind } from "ts-morph";
import { enrichArchitecture } from "./ai.js";
import { defaultConfig, CompileConfig, loadConfig } from "./config.js";
import { loadBrain, loadCheckpoint, saveCheckpoint } from "./storage.js";
import { ProgressReporter, terminalProgress } from "./progress.js";
import { trackRepository } from "./tracker.js";
import { reconcileMemory } from "./memory.js";
import {
  CompileCheckpoint,
  CompileLimits,
  Evidence,
  PackageUnit,
  RepositoryBrain,
} from "./types.js";

const SOURCE_EXTENSIONS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "mts",
  "cts",
  "mjs",
  "cjs",
];
const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
const rel = (root: string, value: string) =>
  path.relative(root, value).replace(/\\/g, "/");
const evidence = (
  source: string,
  detail: string,
  confidence: Evidence["confidence"] = "high",
): Evidence => ({ source, detail, confidence });
const packageFramework = (pkg: any): PackageUnit["framework"] =>
  pkg?.dependencies?.next || pkg?.devDependencies?.next
    ? "nextjs"
    : pkg
      ? "typescript"
      : "unknown";

async function readJson(file: string) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}
async function workspacePatterns(root: string) {
  try {
    const yaml = await fs.readFile(
      path.join(root, "pnpm-workspace.yaml"),
      "utf8",
    );
    return [...yaml.matchAll(/^\s*-\s*["']?([^"'\s]+)["']?\s*$/gm)].map(
      (m) => m[1],
    );
  } catch {
    return [];
  }
}
export async function discoverPackages(
  root: string,
  config: CompileConfig = defaultConfig(),
): Promise<{
  root: string;
  packages: Array<{
    absolute: string;
    relative: string;
    pkg: any;
    isWorkspace: boolean;
  }>;
  ignored: Array<{ path: string; reason: string }>;
}> {
  const abs = path.resolve(root);
  const rootPkg = await readJson(path.join(abs, "package.json"));
  const patterns = await workspacePatterns(abs);
  const packageFiles = patterns.length
    ? await fg(
        patterns.map((p) => `${p}/package.json`),
        { cwd: abs, ignore: config.ignore, onlyFiles: true },
      )
    : [];
  const packages = [
    {
      absolute: abs,
      relative: ".",
      pkg: rootPkg ?? {},
      isWorkspace: patterns.length > 0,
    },
  ];
  for (const file of packageFiles.sort()) {
    const absolute = path.resolve(abs, path.dirname(file));
    if (absolute !== abs)
      packages.push({
        absolute,
        relative: rel(abs, absolute),
        pkg: (await readJson(path.join(abs, file))) ?? {},
        isWorkspace: true,
      });
  }
  const known = new Set(packages.map((p) => p.absolute));
  const nested = await fg(["**/package.json"], {
    cwd: abs,
    ignore: config.ignore,
    onlyFiles: true,
    deep: 8,
  });
  const ignored = nested
    .map((file) => path.resolve(abs, path.dirname(file)))
    .filter((dir) => !known.has(dir))
    .map((dir) => ({
      path: rel(abs, dir),
      reason:
        "nested package is not declared in pnpm-workspace.yaml; analyze it explicitly",
    }));
  return { root: abs, packages, ignored };
}
function routeFor(file: string, framework: PackageUnit["framework"]) {
  if (framework !== "nextjs") return null;
  const app = file.match(/^app\/(.+)\.(tsx?|jsx?)$/);
  const pages = file.match(/^pages\/(.+)\.(tsx?|jsx?)$/);
  if (app) {
    if (app[1].endsWith("/route") || app[1] === "route")
      return {
        router: "next-app" as const,
        kind: "api" as const,
        path: "/" + app[1].replace(/\/route$/, "").replace(/^route$/, ""),
      };
    if (app[1].endsWith("/layout") || app[1] === "layout")
      return {
        router: "next-app" as const,
        kind: "layout" as const,
        path: "/" + app[1].replace(/\/layout$/, "").replace(/^layout$/, ""),
      };
    if (app[1].endsWith("/page") || app[1] === "page")
      return {
        router: "next-app" as const,
        kind: "page" as const,
        path: "/" + app[1].replace(/\/page$/, "").replace(/^page$/, ""),
      };
  }
  if (pages)
    return {
      router: "next-pages" as const,
      kind: pages[1].startsWith("api/") ? ("api" as const) : ("page" as const),
      path:
        "/" + pages[1].replace(/\.(tsx?|jsx?)$/, "").replace(/\/index$/, ""),
    };
  return null;
}
function resolveImport(
  from: string,
  specifier: string,
  sourceFiles: Set<string>,
) {
  if (!specifier.startsWith("."))
    return { target: specifier, kind: "external" as const };
  const rawBase = path
    .normalize(path.join(path.dirname(from), specifier))
    .replace(/\\/g, "/");
  const base = rawBase.replace(/\.(?:[cm]?js|tsx?)$/, "");
  const candidates = [
    rawBase,
    base,
    ...SOURCE_EXTENSIONS.map((ext) => `${base}.${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => `${base}/index.${ext}`),
  ];
  const target = candidates.find((candidate) => sourceFiles.has(candidate));
  return target
    ? { target, kind: "internal" as const }
    : { target: base, kind: "unresolved" as const };
}
function symbolRows(source: SourceFile, packageName: string, file: string) {
  const rows: RepositoryBrain["symbols"] = [];
  const add = (name: string, kind: any, node: any, signature: string) => {
    const pos = source.getLineAndColumnAtPos(node.getStart()).line;
    rows.push({
      name,
      kind,
      file,
      packageName,
      line: pos,
      exported: node.isExported?.() ?? false,
      signature: signature.slice(0, 240),
    });
  };
  source
    .getFunctions()
    .forEach((n) =>
      add(n.getName() ?? "<anonymous>", "function", n, n.getText()),
    );
  source
    .getClasses()
    .forEach((n) =>
      add(n.getName() ?? "<anonymous>", "class", n, n.getText().split("\n")[0]),
    );
  source
    .getInterfaces()
    .forEach((n) =>
      add(
        n.getName() ?? "<anonymous>",
        "interface",
        n,
        n.getText().split("\n")[0],
      ),
    );
  source
    .getTypeAliases()
    .forEach((n) =>
      add(n.getName() ?? "<anonymous>", "type", n, n.getText().split("\n")[0]),
    );
  source
    .getEnums()
    .forEach((n) =>
      add(n.getName() ?? "<anonymous>", "enum", n, n.getText().split("\n")[0]),
    );
  source
    .getVariableDeclarations()
    .forEach((n) =>
      add(
        n.getName() ?? "<anonymous>",
        "variable",
        n,
        n.getText().slice(0, 240),
      ),
    );
  return rows;
}
export type CompileOptions = Partial<CompileLimits> & {
  ai?: boolean;
  resume?: boolean;
  progress?: boolean;
  onProgress?: ProgressReporter;
  signal?: AbortSignal;
  timeoutMs?: number;
};
export type CurrentScan = {
  files: Array<{ path: string; packageName: string; hash: string }>;
  filesDiscovered: number;
  filesSkipped: number;
};
export async function scanRepository(
  root: string,
  options: CompileOptions = {},
): Promise<CurrentScan> {
  const baseConfig = await loadConfig(path.resolve(root));
  const config: CompileConfig = { ...baseConfig };
  for (const key of ["maxFiles", "maxFileSize", "maxTotalBytes"] as const) {
    const value = options[key];
    if (value !== undefined) config[key] = value;
  }
  const progress =
    options.onProgress ?? terminalProgress(options.progress !== false);
  const discovered = await discoverPackages(root, config);
  const files: CurrentScan["files"] = [];
  let filesDiscovered = 0;
  let filesSkipped = 0;
  let bytes = 0;
  progress({
    phase: "discover",
    current: 1,
    total: 1,
    message: `${discovered.packages.length} package(s) discovered`,
  });
  for (const unit of discovered.packages) {
    const packageName =
      unit.pkg.name ??
      (unit.relative === "." ? path.basename(discovered.root) : unit.relative);
    const nestedDirs = [
      ...discovered.packages
        .filter(
          (p) =>
            p.absolute !== unit.absolute &&
            p.absolute.startsWith(unit.absolute + path.sep),
        )
        .map((p) => rel(unit.absolute, p.absolute)),
      ...discovered.ignored.map((i) =>
        rel(unit.absolute, path.resolve(discovered.root, i.path)),
      ),
    ].filter(Boolean);
    const names = await fg([`**/*.{${SOURCE_EXTENSIONS.join(",")}}`], {
      cwd: unit.absolute,
      ignore: [...config.ignore, ...nestedDirs.map((d) => `${d}/**`)],
      onlyFiles: true,
    });
    filesDiscovered += names.length;
    for (const relative of names.sort()) {
      if (files.length >= config.maxFiles) {
        filesSkipped++;
        continue;
      }
      const full = path.join(unit.absolute, relative);
      const stat = await fs.stat(full);
      if (
        stat.size > config.maxFileSize ||
        bytes + stat.size > config.maxTotalBytes
      ) {
        filesSkipped++;
        continue;
      }
      const content = await fs.readFile(full);
      bytes += stat.size;
      files.push({
        path: rel(discovered.root, full),
        packageName,
        hash: hash(content.toString("utf8")),
      });
    }
    progress({
      phase: "hash",
      current: files.length,
      total: filesDiscovered,
      packageName,
      message: `${files.length}/${filesDiscovered} file hashes ready`,
    });
  }
  return {
    files,
    filesDiscovered,
    filesSkipped: filesSkipped + discovered.ignored.length,
  };
}
export async function compileRepository(
  root: string,
  options: CompileOptions = {},
): Promise<RepositoryBrain> {
  const startedAt = Date.now();
  const baseConfig = await loadConfig(path.resolve(root));
  const config: CompileConfig = { ...baseConfig };
  for (const key of [
    "maxFiles",
    "maxFileSize",
    "maxTotalBytes",
  ] as const) {
    const value = options[key];
    if (value !== undefined) config[key] = value;
  }
  if (options.timeoutMs !== undefined) config.ai.timeoutMs = options.timeoutMs;
  const progress =
    options.onProgress ?? terminalProgress(options.progress !== false);
  const limits: CompileLimits = {
    maxFiles: config.maxFiles,
    maxFileSize: config.maxFileSize,
    maxTotalBytes: config.maxTotalBytes,
  };
  const discovered = await discoverPackages(root, config);
  const files: RepositoryBrain["files"] = [];
  const symbols: RepositoryBrain["symbols"] = [];
  const routes: RepositoryBrain["routes"] = [];
  const edges: RepositoryBrain["dependencyGraph"] = [];
  const diagnostics: RepositoryBrain["diagnostics"] = [];
  let filesSkipped = 0;
  let bytesAnalyzed = 0;
  let filesDiscovered = 0;
  let cancelled = false;
  let cache:
    | Pick<
        CompileCheckpoint,
        "files" | "symbols" | "routes" | "dependencyGraph"
      >
    | undefined;
  if (options.resume) {
    const checkpoint = await loadCheckpoint(path.resolve(root));
    if (checkpoint) cache = checkpoint;
    else {
      try {
        cache = await loadBrain(path.resolve(root));
      } catch {
        cache = undefined;
      }
    }
  }
  progress({
    phase: "discover",
    current: 1,
    total: 1,
    message: `${discovered.packages.length} package(s) discovered`,
  });
  for (const unit of discovered.packages) {
    if (options.signal?.aborted) {
      cancelled = true;
      break;
    }
    const packageName =
      unit.pkg.name ??
      (unit.relative === "." ? path.basename(discovered.root) : unit.relative);
    const framework = packageFramework(unit.pkg);
    const tsconfig = (await fs
      .stat(path.join(unit.absolute, "tsconfig.json"))
      .catch(() => undefined))
      ? path.join(unit.absolute, "tsconfig.json")
      : undefined;
    const project = new Project(
      tsconfig
        ? { tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: true }
        : { skipAddingFilesFromTsConfig: true },
    );
    const nestedDirs = [
      ...discovered.packages
        .filter(
          (p) =>
            p.absolute !== unit.absolute &&
            p.absolute.startsWith(unit.absolute + path.sep),
        )
        .map((p) => rel(unit.absolute, p.absolute)),
      ...discovered.ignored.map((i) =>
        rel(unit.absolute, path.resolve(discovered.root, i.path)),
      ),
    ].filter(Boolean);
    const names = await fg([`**/*.{${SOURCE_EXTENSIONS.join(",")}}`], {
      cwd: unit.absolute,
      ignore: [...config.ignore, ...nestedDirs.map((d) => `${d}/**`)],
      onlyFiles: true,
    });
    filesDiscovered += names.length;
    progress({
      phase: "enumerate",
      current: filesDiscovered,
      total: filesDiscovered,
      packageName,
      message: `${names.length} candidate source file(s)`,
    });
    const selected: string[] = [];
    for (const relative of names.sort()) {
      if (
        files.length + selected.length >= limits.maxFiles ||
        bytesAnalyzed >= limits.maxTotalBytes
      ) {
        filesSkipped++;
        continue;
      }
      const full = path.join(unit.absolute, relative);
      const stat = await fs.stat(full);
      if (
        stat.size > limits.maxFileSize ||
        bytesAnalyzed + stat.size > limits.maxTotalBytes
      ) {
        filesSkipped++;
        diagnostics.push({
          severity: "warning",
          message: `Skipped ${relative}: file or total source-size limit exceeded`,
          file: rel(discovered.root, full),
        });
        continue;
      }
      selected.push(relative);
      bytesAnalyzed += stat.size;
    }
    const sourceSet = new Set(names.map((n) => n.replace(/\\/g, "/")));
    const total = selected.length;
    for (let index = 0; index < selected.length; index++) {
      const relative = selected[index];
      if (options.signal?.aborted) {
        cancelled = true;
        break;
      }
      const full = path.join(unit.absolute, relative);
      const text = await fs.readFile(full, "utf8");
      const fileHash = hash(text);
      const globalPath = rel(discovered.root, full);
      const cachedFile = cache?.files.find(
        (file) =>
          file.path === globalPath &&
          file.packageName === packageName &&
          file.hash === fileHash,
      );
      if (cachedFile) {
        files.push(cachedFile);
        symbols.push(
          ...cache!.symbols.filter((symbol) => symbol.file === globalPath),
        );
        routes.push(
          ...cache!.routes.filter((route) => route.file === globalPath),
        );
        edges.push(
          ...cache!.dependencyGraph.filter((edge) => edge.from === globalPath),
        );
        progress({
          phase: "parse",
          current: index + 1,
          total,
          packageName,
          file: globalPath,
          message: "reused unchanged analysis",
        });
      } else {
        let source: SourceFile;
        try {
          source = project.addSourceFileAtPath(full);
        } catch (error) {
          diagnostics.push({
            severity: "error",
            message: `Could not parse ${relative}: ${error instanceof Error ? error.message : String(error)}`,
            file: globalPath,
          });
          continue;
        }
        const imports = source
          .getImportDeclarations()
          .map((i) => i.getModuleSpecifierValue());
        const exports = source.getExportSymbols().map((s) => s.getName());
        const preview = text
          .split("\n")
          .slice(0, 100)
          .join("\n")
          .slice(0, 8000);
        files.push({
          path: globalPath,
          packageName,
          kind: path.extname(relative).slice(1) as any,
          hash: fileHash,
          lines: text.split("\n").length,
          imports,
          exports,
          preview,
          diagnostics: [],
          evidence: [
            evidence(
              globalPath,
              "source file discovered within the owning package",
            ),
          ],
        });
        symbols.push(...symbolRows(source, packageName, globalPath));
        const route = routeFor(relative, framework);
        if (route) {
          const methods =
            route.kind === "api"
              ? source
                  .getFunctions()
                  .filter((f) => f.isExported())
                  .map((f) => f.getName())
                  .filter((n): n is string => Boolean(n))
              : [];
          routes.push({
            ...route,
            file: globalPath,
            packageName,
            methods,
            evidence: [
              evidence(
                globalPath,
                `matched ${route.router} ${route.kind} convention`,
              ),
            ],
          });
        }
        for (const specifier of imports) {
          const resolved = resolveImport(relative, specifier, sourceSet);
          edges.push({
            from: globalPath,
            to:
              resolved.kind === "external"
                ? resolved.target
                : rel(
                    discovered.root,
                    path.join(unit.absolute, resolved.target),
                  ),
            kind: resolved.kind,
            packageName,
            evidence: [evidence(globalPath, `imported ${specifier}`)],
          });
        }
        progress({
          phase: "extract",
          current: index + 1,
          total,
          packageName,
          file: globalPath,
          message: "analyzed",
        });
      }
      if ((index + 1) % 25 === 0)
        await saveCheckpoint(discovered.root, {
          version: 1,
          rootPath: discovered.root,
          files,
          symbols,
          routes,
          dependencyGraph: edges,
          filesDiscovered,
          filesSkipped,
          bytesAnalyzed,
        });
    }
  }
  if (cancelled)
    await saveCheckpoint(discovered.root, {
      version: 1,
      rootPath: discovered.root,
      files,
      symbols,
      routes,
      dependencyGraph: edges,
      filesDiscovered,
      filesSkipped,
      bytesAnalyzed,
    });
  const packageRows = discovered.packages.map((unit) => {
    const packageName =
      unit.pkg.name ??
      (unit.relative === "." ? path.basename(discovered.root) : unit.relative);
    const packageFiles = files.filter((f) => f.packageName === packageName);
    const packageRoutes = routes.filter((r) => r.packageName === packageName);
    const framework = packageFramework(unit.pkg);
    return {
      name: packageName,
      rootPath: unit.absolute,
      relativePath: unit.relative,
      framework,
      scripts: unit.pkg.scripts ?? {},
      dependencies: unit.pkg.dependencies ?? {},
      devDependencies: unit.pkg.devDependencies ?? {},
      fileCount: packageFiles.length,
      symbolCount: symbols.filter((s) => s.packageName === packageName).length,
      routeCount: packageRoutes.length,
      evidence: [
        evidence(
          path.join(unit.relative, "package.json"),
          unit.pkg.name
            ? "package name read from package.json"
            : "package boundary discovered without a package name",
          unit.pkg.name ? "high" : "medium",
        ),
      ],
    };
  });
  const trackedFiles = await trackRepository(discovered.root, {
    config,
    excludedPaths: discovered.ignored.map((item) => item.path),
  });
  const fingerprint = hash(
    trackedFiles
      .map((file) => `${file.path}:${file.hash ?? `${file.size}:${file.mtimeMs}`}`)
      .join("\n"),
  );
  const packageManager =
    (await fs
      .access(path.join(discovered.root, "pnpm-lock.yaml"))
      .then(() => "pnpm")
      .catch(() => undefined)) ??
    (await fs
      .access(path.join(discovered.root, "package-lock.json"))
      .then(() => "npm")
      .catch(() => "unknown"));
  const brain: RepositoryBrain = {
    brainVersion: 2,
    repo: {
      name:
        (await readJson(path.join(discovered.root, "package.json")))?.name ??
        path.basename(discovered.root),
      rootPath: discovered.root,
      packageManager,
      isWorkspace:
        discovered.packages.length > 1 ||
        (await workspacePatterns(discovered.root)).length > 0,
    },
    compiledAt: new Date().toISOString(),
    fingerprint,
    trackedFiles,
    status: cancelled
      ? "cancelled"
      : filesSkipped || diagnostics.some((d) => d.severity === "warning")
        ? "partial"
        : "complete",
    analysis: {
      filesDiscovered,
      filesAnalyzed: files.length,
      filesSkipped,
      bytesAnalyzed,
      durationMs: Date.now() - startedAt,
      limits,
    },
    packages: packageRows,
    files,
    symbols,
    routes,
    dependencyGraph: edges,
    diagnostics,
    ignored: discovered.ignored,
    architectureSummary: `${packageRows.length} package${packageRows.length === 1 ? "" : "s"} analyzed: ${files.length} files, ${symbols.length} symbols, ${routes.length} routes, and ${edges.filter((e) => e.kind === "internal").length} resolved internal edges.`,
    ai: { status: "not-configured" },
  };
  brain.memory = reconcileMemory(brain);
  progress({
    phase: "persist",
    current: 1,
    total: 1,
    message: `${brain.status} analysis ready`,
  });
  brain.ai =
    options.ai === false
      ? { status: "not-configured" }
      : await enrichArchitecture(brain, config.ai, progress);
  return brain;
}
