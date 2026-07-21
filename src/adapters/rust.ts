import { RepositoryBrain } from "../types.js";

export const rustExtensions = ["rs"];

export function rustFacts(file: string, text: string, packageName: string) {
  const symbols: RepositoryBrain["symbols"] = [];
  const imports = [...text.matchAll(/^\s*(?:use|mod)\s+([^;]+);/gm)].map((match) => match[1]);
  let pendingTest = false;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (/^\s*#\[test\]/.test(line)) { pendingTest = true; continue; }
    const declaration = line.match(/^\s*(pub\s+)?(fn|struct|enum|trait|type)\s+(\w+)/);
    if (!declaration) continue;
    const kind = declaration[2] === "fn" ? "function" : declaration[2] === "struct" ? "class" : declaration[2] === "enum" ? "enum" : declaration[2] === "trait" ? "interface" : "type";
    symbols.push({ name: declaration[3], kind, file, packageName, line: index + 1, exported: Boolean(declaration[1]), signature: line.trim(), declaration: line.trim() });
    pendingTest = false;
  }
  const routes = [...text.matchAll(/\.route\(\s*"([^"]+)"\s*,\s*(?:get|post|put|delete)\(/g)].map((match) => ({ path: match[1] }));
  const calls = [...text.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map((match) => ({ symbol: match[1], line: text.slice(0, match.index).split("\n").length }));
  return { imports, symbols, routes, calls };
}
