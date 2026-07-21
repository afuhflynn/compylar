import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { Project, SourceFile } from "ts-morph";
import { enrichArchitecture } from "./ai.js";
import { defaultConfig, CompileConfig, loadConfig } from "./config.js";
import { loadBrain, loadCheckpoint, saveCheckpoint } from "./storage.js";
import { ProgressReporter, terminalProgress } from "./progress.js";
import { trackRepository } from "./tracker.js";
import { deriveRepositoryProfile, reconcileMemory } from "./memory.js";
import { capabilitiesFor, supportedSourceExtensions } from "./adapters.js";
import { resolveTypeScriptImport, routeForTypeScript, typeScriptRelationships, typeScriptSymbols } from "./adapters/typescript.js";
import { prismaFacts } from "./adapters/prisma.js";
import { goFacts } from "./adapters/go.js";
import { pythonFacts as extractPythonFacts, resolvePythonImport as resolvePythonAdapterImport } from "./adapters/python.js";
import { rustFacts } from "./adapters/rust.js";
import {
  CompileCheckpoint,
  CompileLimits,
  Evidence,
  PackageUnit,
  RepositoryBrain,
} from "./types.js";

const SOURCE_EXTENSIONS = supportedSourceExtensions;
const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
const rel = (root: string, value: string) =>
  path.relative(root, value).replace(/\\/g, "/");
const evidence = (
  source: string,
  detail: string,
  confidence: Evidence["confidence"] = "high",
): Evidence => ({ source, detail, confidence });
const packageFramework = async (pkg: any, root: string): Promise<PackageUnit["framework"]> =>
  pkg?.dependencies?.next || pkg?.devDependencies?.next
    ? "nextjs"
    : await fs.access(path.join(root, "pyproject.toml")).then(() => "python").catch(() => fs.access(path.join(root, "go.mod")).then(() => "go").catch(() => fs.access(path.join(root, "Cargo.toml")).then(() => "rust").catch(() => pkg && Object.keys(pkg).length ? "typescript" : "unknown")));

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
    const block = [...yaml.matchAll(/^\s*-\s*["']?([^"'\s]+)["']?\s*$/gm)].map(
      (m) => m[1],
    );
    const inline = [...yaml.matchAll(/^\s*packages\s*:\s*\[([^\]]+)\]/gm)]
      .flatMap((match) => match[1].split(",").map((value) => value.trim().replace(/^["']|["']$/g, "")))
      .filter(Boolean);
    return [...new Set([...block, ...inline])];
  } catch {
    return [];
  }
}
function prismaRows(file: string, text: string): NonNullable<RepositoryBrain["prisma"]> {
  const rows: NonNullable<RepositoryBrain["prisma"]> = [];
  const lines = text.split(/\r?\n/);
  let current: NonNullable<RepositoryBrain["prisma"]>[number] | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const declaration = line.match(/^\s*(model|enum)\s+(\w+)\s*\{/);
    if (declaration) {
      current = { name: declaration[2], kind: declaration[1] as "model" | "enum", file, line: index + 1, fields: [], relations: [] };
      rows.push(current);
      continue;
    }
    if (!current || /^\s*}/.test(line) || /^\s*\/\//.test(line)) { if (/^\s*}/.test(line)) current = undefined; continue; }
    const field = line.match(/^\s*(\w+)\s+([\w\[\]?]+)/);
    if (!field) continue;
    current.fields.push({ name: field[1], type: field[2], line: index + 1 });
    const target = field[2].replace(/[\[\]?]/g, "");
    if (/\@relation\b/.test(line) || /^[A-Z]/.test(target)) current.relations.push({ field: field[1], target, line: index + 1 });
  }
  return rows;
}
function pythonFacts(file: string, text: string, packageName: string) {
  const symbols: RepositoryBrain["symbols"] = [];
  const imports: string[] = [];
  const routes: Array<{ path: string; method: string; line: number }> = [];
  const lines = text.split(/\r?\n/);
  let decorator: { path: string; method: string; line: number } | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const imported = line.match(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/);
    if (imported) imports.push(imported[1] ?? imported[2]);
    const route = line.match(/^\s*@\w+\.(get|post|put|patch|delete)\(\s*["']([^"']+)/i);
    if (route) decorator = { method: route[1].toUpperCase(), path: route[2], line: index + 1 };
    const declaration = line.match(/^\s*(def|class)\s+(\w+)/);
    if (declaration) {
      const kind = declaration[1] === "class" ? "class" : "function";
      symbols.push({ name: declaration[2], kind, file, packageName, line: index + 1, exported: !declaration[2].startsWith("_"), signature: line.trim(), declaration: line.trim() });
      if (decorator && kind === "function") { routes.push(decorator); decorator = undefined; }
    }
  }
  return { imports: [...new Set(imports)], symbols, routes };
}
function resolvePythonImport(from: string, specifier: string, sourceFiles: Set<string>) {
  const module = specifier.replace(/^\.+/, "").replace(/\./g, "/");
  const candidates = [`${module}.py`, `${module}/__init__.py`];
  const target = candidates.find((candidate) => sourceFiles.has(candidate));
  return target ? { target, kind: "internal" as const } : { target: specifier, kind: "external" as const };
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

async function documentationSynopsis(root: string) {
  try {
    const content = await fs.readFile(path.join(root, "README.md"), "utf8");
    const lines = content.split(/\r?\n/).map((line) => line.trim());
    const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "");
    const paragraph = lines.find((line) => line && !line.startsWith("#") && !line.startsWith("<!--") && !line.startsWith("```"));
    return [title, paragraph].filter(Boolean).join(" — ").slice(0, 500);
  } catch {
    return undefined;
  }
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
      declaration: signature.slice(0, 16 * 1024),
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
  const pendingReferences: Array<{ from: string; symbol: string; line: number; kind: "call" | "reference" | "test" }> = [];
  const guards: NonNullable<RepositoryBrain["guards"]> = [];
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
    const framework = await packageFramework(unit.pkg, unit.absolute);
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
        if (path.extname(relative) === ".rs") {
          const parsed = rustFacts(globalPath, text, packageName);
          const preview = text.split("\n").slice(0, 100).join("\n").slice(0, 8000);
          files.push({ path: globalPath, packageName, kind: "rs", hash: fileHash, lines: text.split("\n").length, imports: parsed.imports, exports: parsed.symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name), preview, diagnostics: [], evidence: [evidence(globalPath, "Rust source file discovered within the owning package")] });
          symbols.push(...parsed.symbols);
          for (const route of parsed.routes) routes.push({ path: route.path, file: globalPath, packageName, router: "axum", kind: "api", methods: [], evidence: [evidence(globalPath, "matched Axum route convention")] });
          const testFile = /(?:^|\/)tests?\/|#\[test\]/.test(text);
          pendingReferences.push(...parsed.calls.filter((call) => !["fn", "if", "for", "match"].includes(call.symbol)).map((call) => ({ from: globalPath, symbol: call.symbol, line: call.line, kind: testFile ? "test" as const : "call" as const })));
          progress({ phase: "extract", current: index + 1, total, packageName, file: globalPath, message: "analyzed" });
          continue;
        }
        if (path.extname(relative) === ".go") {
          const parsed = goFacts(globalPath, text, packageName);
          const preview = text.split("\n").slice(0, 100).join("\n").slice(0, 8000);
          files.push({ path: globalPath, packageName, kind: "go", hash: fileHash, lines: text.split("\n").length, imports: parsed.imports, exports: parsed.symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name), preview, diagnostics: [], evidence: [evidence(globalPath, "Go source file discovered within the owning package")] });
          symbols.push(...parsed.symbols);
          for (const route of parsed.routes) routes.push({ path: route.path, file: globalPath, packageName, router: "go-net-http", kind: "api", methods: [], evidence: [evidence(globalPath, `matched net/http handler ${route.handler}`)] });
          const testFile = /_test\.go$/.test(globalPath);
          pendingReferences.push(...parsed.calls.filter((call) => !["func", "if", "for", "switch"].includes(call.symbol)).map((call) => ({ from: globalPath, symbol: call.symbol, line: call.line, kind: testFile ? "test" as const : "call" as const })));
          progress({ phase: "extract", current: index + 1, total, packageName, file: globalPath, message: "analyzed" });
          continue;
        }
        if (path.extname(relative) === ".py") {
          const parsed = extractPythonFacts(globalPath, text, packageName);
          const preview = text.split("\n").slice(0, 100).join("\n").slice(0, 8000);
          files.push({ path: globalPath, packageName, kind: "py", hash: fileHash, lines: text.split("\n").length, imports: parsed.imports, exports: parsed.symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name), preview, diagnostics: [], evidence: [evidence(globalPath, "Python source file discovered within the owning package")] });
          symbols.push(...parsed.symbols);
          for (const route of parsed.routes) routes.push({ path: route.path, file: globalPath, packageName, router: "fastapi", kind: "api", methods: [route.method], evidence: [evidence(globalPath, "matched FastAPI decorator convention")] });
          for (const specifier of parsed.imports) {
            const resolved = resolvePythonAdapterImport(specifier, sourceSet);
            edges.push({ from: globalPath, to: resolved.kind === "internal" ? rel(discovered.root, path.join(unit.absolute, resolved.target)) : resolved.target, kind: resolved.kind, packageName, evidence: [evidence(globalPath, `imported ${specifier}`)] });
          }
          const testFile = /(?:^|\/)(?:test|tests)\/|^test_.*\.py$/.test(globalPath);
          for (const call of [...text.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)]) {
            if (!["def", "class", "if", "for", "while", "return"].includes(call[1])) pendingReferences.push({ from: globalPath, symbol: call[1], line: text.slice(0, call.index).split("\n").length, kind: testFile ? "test" : "call" });
          }
          progress({ phase: "extract", current: index + 1, total, packageName, file: globalPath, message: "analyzed" });
          continue;
        }
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
        const imports = [...new Set([
          ...source.getImportDeclarations().map((item) => item.getModuleSpecifierValue()),
          ...source.getExportDeclarations()
            .map((item) => item.getModuleSpecifierValue())
            .filter((item): item is string => Boolean(item)),
        ])];
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
        symbols.push(...typeScriptSymbols(source, packageName, globalPath));
        const relationships = typeScriptRelationships(source, globalPath, text);
        pendingReferences.push(...relationships.references);
        guards.push(...relationships.guards);
        const route = routeForTypeScript(relative, framework);
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
          const resolved = resolveTypeScriptImport(relative, specifier, sourceSet);
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
    const framework = packageFiles.some((file) => file.kind === "rs")
      ? "rust"
      : packageFiles.some((file) => file.kind === "go")
      ? "go"
      : packageFiles.some((file) => file.kind === "py")
      ? "python"
      : unit.pkg?.dependencies?.next || unit.pkg?.devDependencies?.next
        ? "nextjs"
        : packageFiles.length ? "typescript" : "unknown";
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
  const prisma: NonNullable<RepositoryBrain["prisma"]> = [];
  for (const schema of await fg(["**/*.prisma"], { cwd: discovered.root, ignore: config.ignore, onlyFiles: true })) {
    const full = path.join(discovered.root, schema);
    const text = await fs.readFile(full, "utf8");
    prisma.push(...prismaFacts(rel(discovered.root, full), text));
  }
  const facts: NonNullable<RepositoryBrain["facts"]> = [];
  for (const pkg of packageRows) for (const [name, command] of Object.entries(pkg.scripts as Record<string, string>)) facts.push({ kind: "script", name: `${pkg.name}:${name}`, summary: command, source: pkg.relativePath === "." ? "package.json" : `${pkg.relativePath}/package.json`, line: 1, confidence: "high" });
  for (const item of prisma) facts.push({ kind: "schema", name: `${item.kind} ${item.name}`, summary: `${item.kind} ${item.name}: ${item.fields.map((field) => `${field.name}: ${field.type}`).join(", ")}`, source: item.file, line: item.line, confidence: "high" });
  const docPaths = await fg(["README.md", "CONTRIBUTING.md", "docs/**/*.md", "ARCHITECTURE.md"], { cwd: discovered.root, ignore: config.ignore, onlyFiles: true });
  for (const file of docPaths) {
    const content = await fs.readFile(path.join(discovered.root, file), "utf8");
    const rows = content.split(/\r?\n/); const line = Math.max(0, rows.findIndex((row) => /^#\s+/.test(row)));
    const title = rows[line]?.replace(/^#+\s+/, "").trim() || file;
    const excerpt = rows.slice(line + 1).find((row) => row.trim() && !row.startsWith("#"))?.trim().slice(0, 500);
    facts.push({ kind: /^#{1,3}\s*(?:setup|install|quick start)\b/im.test(content) || /README\.md$/i.test(file) ? "setup" : "documentation", name: title, summary: excerpt || "Repository documentation.", source: file, line: line + 1, excerpt, confidence: "high" });
  }
  const envPaths = await fg([".env.example", ".env.sample", ".env.template", "**/.env.example", "**/.env.sample", "**/.env.template"], { cwd: discovered.root, ignore: config.ignore, onlyFiles: true });
  for (const file of envPaths) {
    const rows = (await fs.readFile(path.join(discovered.root, file), "utf8")).split(/\r?\n/);
    rows.forEach((row, index) => { const match = row.match(/^\s*([A-Z][A-Z0-9_]+)=(.*)$/); if (match) facts.push({ kind: "environment", name: match[1], summary: `${match[1]} is declared by ${file}${match[2] ? " with a safe example/default marker" : " and requires a value"}.`, source: file, line: index + 1, confidence: "high" }); });
  }
  for (const file of files) {
    if (/(?:^|\/)(?:test|tests)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file.path)) continue;
    const text = await fs.readFile(path.join(discovered.root, file.path), "utf8").catch(() => "");
    if (/^[\"']use server[\"'];?/m.test(text)) {
      for (const symbol of symbols.filter((symbol) => symbol.file === file.path && symbol.kind === "function" && symbol.exported)) facts.push({ kind: "server-action", name: symbol.name, summary: `Server Action exported by ${file.path}.`, source: file.path, line: symbol.line, confidence: "high" });
    }
    if (/\b(?:inngest\.createFunction|new\s+Worker|Worker\s*\()/m.test(text)) facts.push({ kind: "job", name: path.basename(file.path), summary: /inngest\.createFunction/.test(text) ? "Inngest job registration." : "Queue worker registration.", source: file.path, line: 1, confidence: "medium" });
  }
  const defined = new Set(symbols.map((symbol) => symbol.name));
  const references: NonNullable<RepositoryBrain["references"]> = pendingReferences
    .filter((reference) => defined.has(reference.symbol))
    .map((reference) => ({ ...reference, to: symbols.find((symbol) => symbol.name === reference.symbol)?.file ?? reference.from, confidence: "high" as const }));
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
    brainVersion: 4,
    prisma,
    facts,
    references,
    guards,
    capabilities: [],
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
    semanticIndex: {
      schemaVersion: 1,
      status: "absent",
      coverage: [],
      blockers: [],
      unknowns: [],
      findingCount: 0,
    },
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
  brain.capabilities = capabilitiesFor(brain);
  brain.memory = reconcileMemory(brain);
  brain.profile = deriveRepositoryProfile(brain);
  const synopsis = await documentationSynopsis(discovered.root);
  if (synopsis && brain.profile) {
    brain.profile.summary = `${synopsis.replace(/[.\s]+$/, "")}. ${brain.architectureSummary}`;
    brain.profile.evidence = [
      { source: "README.md", detail: "repository README title and opening synopsis", confidence: "high" },
      ...brain.profile.evidence,
    ];
    brain.profile.unknowns = brain.profile.unknowns.filter((unknown) => !unknown.includes("purpose"));
  }
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
