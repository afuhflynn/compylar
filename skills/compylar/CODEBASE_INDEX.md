# Bundled Codebase Index Workflow

This is Compylar's required first-time semantic index. Run it after `compylar bootstrap . --json` reports `full-index`, before feature work. It is read-only except for `CODEBASE_INDEX.md` and `.compylar/semantic-index.json`.

## Six phases

1. **Surface scan**: establish project purpose, languages, frameworks, package/workspace shape, directories, and generated/vendor exclusions.
2. **Configuration and entry points**: inspect build, environment metadata (never secret values), lint, deployment, CLI, HTTP, worker, and library entry points.
3. **Dependencies**: reconcile imports, packages, and external dependencies with the deterministic Brain; trace unresolved or cross-package edges.
4. **Domain and data flow**: inspect schemas, contracts, state, important entities, and end-to-end flows. Record explicit uncertainty rather than guessing.
5. **Tests and infrastructure**: identify test strategy, CI, deployment, runtime boundaries, and meaningful guarantees.
6. **Synthesis and verification**: write the human index, verify every discovered import target is cataloged or explicitly external/blocked, then emit the manifest below.

Use the appropriate depth for each area: inspect entry points, domain logic, schemas, routes, and configuration; catalog utilities/tests/docs; skip generated output, dependencies, and binaries. For large repositories, delegate non-overlapping read-only scopes and consolidate citations.

## Required human artifact

Write `CODEBASE_INDEX.md` at the repository root. It must include project identity, directory map, entry points, configuration, module dependencies, domain model, external dependencies, test strategy, infrastructure, unknowns, verification result, and citations (`path:start-end`) for every claim.

## Required machine manifest

Write `.compylar/semantic-index.json`, then run `compylar ingest-index .`. The manifest is the only semantic artifact Compylar ingests; it must never invent a claim not supported by its citations.

```json
{
  "schemaVersion": 1,
  "producer": { "name": "codebase-index", "version": "bundled-with-compylar-0.1.1" },
  "generatedAt": "ISO-8601 timestamp",
  "brainFingerprint": "output from compylar bootstrap/brain JSON",
  "artifact": { "path": "CODEBASE_INDEX.md", "sha256": "sha256 of the exact artifact bytes" },
  "verification": { "complete": true, "blockers": [] },
  "coverage": ["foundation", "system", "flow", "contract", "test-guarantee", "convention", "unknown"],
  "unknowns": [],
  "findings": [{
    "key": "stable-kebab-case-fact-key",
    "kind": "flow",
    "summary": "A concise, reusable, evidence-backed fact.",
    "confidence": "high",
    "sources": [{ "path": "src/example.ts", "startLine": 10, "endLine": 22 }]
  }]
}
```

Required coverage may be incomplete only when `verification.blockers` explains why. Record reusable facts, not a transcript: stable architecture, flows, contracts, constraints, conventions, gotchas, and unknowns. The manifest is refreshed incrementally after later deep reads; do not repeat a full index for a current Brain.
