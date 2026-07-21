import { RepositoryBrain } from "../types.js";

export const pythonExtensions = ["py"];

export function pythonFacts(file: string, text: string, packageName: string) {
  const symbols: RepositoryBrain["symbols"] = [];
  const imports: string[] = [];
  const routes: Array<{ path: string; method: string }> = [];
  let decorator: { path: string; method: string } | undefined;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const imported = line.match(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/); if (imported) imports.push(imported[1] ?? imported[2]);
    const route = line.match(/^\s*@\w+\.(get|post|put|patch|delete)\(\s*["']([^"']+)/i); if (route) decorator = { method: route[1].toUpperCase(), path: route[2] };
    const declaration = line.match(/^\s*(def|class)\s+(\w+)/); if (!declaration) continue;
    const kind = declaration[1] === "class" ? "class" : "function";
    symbols.push({ name: declaration[2], kind, file, packageName, line: index + 1, exported: !declaration[2].startsWith("_"), signature: line.trim(), declaration: line.trim() });
    if (decorator && kind === "function") { routes.push(decorator); decorator = undefined; }
  }
  return { imports: [...new Set(imports)], symbols, routes };
}

export function resolvePythonImport(specifier: string, sourceFiles: Set<string>) {
  const module = specifier.replace(/^\.+/, "").replace(/\./g, "/");
  const target = [`${module}.py`, `${module}/__init__.py`].find((candidate) => sourceFiles.has(candidate));
  return target ? { target, kind: "internal" as const } : { target: specifier, kind: "external" as const };
}
