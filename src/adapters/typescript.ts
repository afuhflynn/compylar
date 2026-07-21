import path from "node:path";
import { SourceFile, SyntaxKind } from "ts-morph";
import { RepositoryBrain } from "../types.js";

export const typeScriptExtensions = ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"];

export function routeForTypeScript(file: string, framework: string) {
  if (framework !== "nextjs") return null;
  const app = file.match(/^app\/(.+)\.(tsx?|jsx?)$/);
  const pages = file.match(/^pages\/(.+)\.(tsx?|jsx?)$/);
  if (app) {
    const route = (suffix: "route" | "layout" | "page", kind: "api" | "layout" | "page") => app[1].endsWith(`/${suffix}`) || app[1] === suffix
      ? { router: "next-app", kind, path: "/" + app[1].replace(new RegExp(`/${suffix}$`), "").replace(new RegExp(`^${suffix}$`), "") }
      : null;
    return route("route", "api") ?? route("layout", "layout") ?? route("page", "page");
  }
  return pages ? { router: "next-pages", kind: pages[1].startsWith("api/") ? "api" : "page", path: "/" + pages[1].replace(/\.(tsx?|jsx?)$/, "").replace(/\/index$/, "") } : null;
}

export function resolveTypeScriptImport(from: string, specifier: string, sourceFiles: Set<string>) {
  if (!specifier.startsWith(".")) return { target: specifier, kind: "external" as const };
  const rawBase = path.normalize(path.join(path.dirname(from), specifier)).replace(/\\/g, "/");
  const base = rawBase.replace(/\.(?:[cm]?js|tsx?)$/, "");
  const candidates = [rawBase, base, ...typeScriptExtensions.map((ext) => `${base}.${ext}`), ...typeScriptExtensions.map((ext) => `${base}/index.${ext}`)];
  const target = candidates.find((candidate) => sourceFiles.has(candidate));
  return target ? { target, kind: "internal" as const } : { target: base, kind: "unresolved" as const };
}

export function typeScriptSymbols(source: SourceFile, packageName: string, file: string) {
  const rows: RepositoryBrain["symbols"] = [];
  const add = (name: string, kind: any, node: any, signature: string) => rows.push({ name, kind, file, packageName, line: source.getLineAndColumnAtPos(node.getStart()).line, exported: node.isExported?.() ?? false, signature: signature.slice(0, 240), declaration: signature.slice(0, 16 * 1024) });
  source.getFunctions().forEach((node) => add(node.getName() ?? "<anonymous>", "function", node, node.getText()));
  source.getClasses().forEach((node) => add(node.getName() ?? "<anonymous>", "class", node, node.getText().split("\n")[0]));
  source.getInterfaces().forEach((node) => add(node.getName() ?? "<anonymous>", "interface", node, node.getText().split("\n")[0]));
  source.getTypeAliases().forEach((node) => add(node.getName() ?? "<anonymous>", "type", node, node.getText().split("\n")[0]));
  source.getEnums().forEach((node) => add(node.getName() ?? "<anonymous>", "enum", node, node.getText().split("\n")[0]));
  source.getVariableDeclarations().forEach((node) => add(node.getName() ?? "<anonymous>", "variable", node, node.getText().slice(0, 240)));
  return rows;
}

export function typeScriptRelationships(source: SourceFile, file: string, text: string) {
  const testFile = /(?:^|\/)(?:test|tests)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);
  const references: Array<{ from: string; symbol: string; line: number; kind: "call" | "test" }> = [];
  const guards: NonNullable<RepositoryBrain["guards"]> = [];
  for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const symbol = call.getExpression().getText().split(".").pop();
    if (!symbol || !/^[A-Za-z_$][\w$]*$/.test(symbol)) continue;
    const line = source.getLineAndColumnAtPos(call.getStart()).line;
    references.push({ from: file, symbol, line, kind: testFile ? "test" : "call" });
    if (/^(requireAuth|requireSession|requireUnAuth)$/i.test(symbol)) guards.push({ file, line, kind: "guard-call", name: symbol, matcher: [] });
  }
  if (/(?:^|\/)(?:middleware|proxy)\.[cm]?[jt]s$/.test(file)) {
    const matcher = [...text.matchAll(/matcher\s*:\s*\[([^\]]*)\]/g)].flatMap((match) => match[1].match(/['\"]([^'\"]+)['\"]/g) ?? []).map((value) => value.slice(1, -1));
    guards.push({ file, line: 1, kind: /proxy\./.test(file) ? "proxy" : "middleware", name: path.basename(file), matcher });
  }
  return { references, guards };
}
