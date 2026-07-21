import { RepositoryBrain } from "../types.js";

/** Prisma is a schema adapter; the core receives only normalized entity facts. */
export function prismaFacts(file: string, text: string): NonNullable<RepositoryBrain["prisma"]> {
  const rows: NonNullable<RepositoryBrain["prisma"]> = [];
  const lines = text.split(/\r?\n/);
  let current: NonNullable<RepositoryBrain["prisma"]>[number] | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const declaration = lines[index].match(/^\s*(model|enum)\s+(\w+)\s*\{/);
    if (declaration) { current = { name: declaration[2], kind: declaration[1] as "model" | "enum", file, line: index + 1, fields: [], relations: [] }; rows.push(current); continue; }
    if (!current || /^\s*}/.test(lines[index]) || /^\s*\/\//.test(lines[index])) { if (/^\s*}/.test(lines[index])) current = undefined; continue; }
    const field = lines[index].match(/^\s*(\w+)\s+([\w\[\]?]+)/);
    if (!field) continue;
    current.fields.push({ name: field[1], type: field[2], line: index + 1 });
    const target = field[2].replace(/[\[\]?]/g, "");
    if (/\@relation\b/.test(lines[index]) || /^[A-Z]/.test(target)) current.relations.push({ field: field[1], target, line: index + 1 });
  }
  return rows;
}
