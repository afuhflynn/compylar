import { RepositoryBrain } from "../types.js";

export const goExtensions = ["go"];

export function goFacts(file: string, text: string, packageName: string) {
  const symbols: RepositoryBrain["symbols"] = [];
  const imports = [...text.matchAll(/(?:import\s+)?"([^"]+)"/g)].map((match) => match[1]);
  for (const match of text.matchAll(/^func\s+(\w+)\s*\(([^)]*)\)/gm)) {
    const line = text.slice(0, match.index).split("\n").length;
    symbols.push({ name: match[1], kind: "function", file, packageName, line, exported: /^[A-Z]/.test(match[1]), signature: match[0], declaration: match[0] });
  }
  const routes = [...text.matchAll(/http\.HandleFunc\(\s*"([^"]+)"\s*,\s*(\w+)/g)].map((match) => ({ path: match[1], handler: match[2] }));
  const calls = [...text.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map((match) => ({ symbol: match[1], line: text.slice(0, match.index).split("\n").length }));
  return { imports, symbols, routes, calls };
}
