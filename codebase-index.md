---
name: codebase-index
description: "Use this skill when an agent needs to thoroughly index and understand every part of a codebase before working on it. Guides a depth-first, systematic inventory of all files, modules, dependencies, data flow, tests, configuration, and infrastructure. Produces a comprehensive codebase index artifact. Do not use for code review, bug diagnosis, module design, or general teaching."
compatibility: Works with any language or framework. Uses read, glob, and grep tools for exploration; no destructive operations.
---

# Exploration Depth

**Purpose**: Define how deep to explore each part of the codebase — when to drill down to every function and when a directory summary is enough.

## 1. Depth Levels

| Level | Description | When to use |
|---|---|---|
| **catalog** | List every file in the directory with a one-line purpose. Read the first 20 lines of each file. | Directories with many small, similar files (e.g., utility modules, migration scripts, generated code). |
| **inspect** | Read every file in full. Trace all imports/exports. Document exported symbols, key functions, types. | Core modules, entry points, data models, API routes, main business logic. |
| **scan** | Read only the file headers, exports, and public API surface. Do not trace internal implementation. | Third-party wrappers, adapters, polyfills, type definition files (`.d.ts`), vendored dependencies. |
| **skip** | List the directory and note its purpose but do not read individual files. | Generated output directories (`dist/`, `build/`, `node_modules/`, `.git/`), dependency caches, IDE config. |

## 2. Default Depth by Target

| Codebase area | Default depth | Rationale |
|---|---|---|
| Entry points (main, app, index, CLI) | inspect | Understand how the application starts and routes. |
| Core domain modules | inspect | Business logic is where complexity lives. |
| Data models, schemas, types | inspect | Data shapes are referenced everywhere. |
| API routes, controllers, handlers | inspect | Every endpoint is a contract point. |
| Configuration files | inspect | Configs control behavior; missing one means missing understanding. |
| Tests | catalog | Test structure matters; individual test content can be sampled. |
| Utility / helper modules | catalog | Read enough to know what's available. |
| Migration scripts | catalog | Note what they do; skip full reading unless DB schema is in focus. |
| Build / CI config | scan | Note the system used and key scripts; don't trace every CI step. |
| Documentation files | catalog | Note topics covered; read in full only if relevant to the index. |
| Generated / vendored code | skip | Not author-intent code. |
| Lock files, binary files | skip | Not human-readable structure. |

## 3. Parallelization Threshold

If the codebase has more than 20 top-level directories or more than 500 files (excluding `skip`-level areas), spawn parallel sub-agents for Phases 2–5.

Each sub-agent should receive:

```
Objective: [phase name for this directory/module group]
Scope: [specific directories or modules]
Mode: read-only
Ownership: these files only
Output: structured findings in the format from `rules/artifact-format.md#section-format`
Stop condition: all files in scope cataloged at the required depth, or blocker documented
```

## 4. Depth Adjustment Rules

- If a file at `catalog` depth reveals unexpected complexity (e.g., a utility module that actually contains business logic), promote to `inspect`.
- If a file at `inspect` depth is clearly boilerplate (e.g., getter/setter wrappers), demote to `catalog`.
- When in doubt, use the deeper level. The skill's goal is completeness.

## 5. Stopping

Stop exploring a directory only when:

- Every file has been read at the assigned depth level.
- Files at `inspect` depth have had their imports traced.
- The directory's purpose, relation to other modules, and ownership (if discernible) are documented.
- Or a blocker is documented (permission denied, missing dependency, binary format).

Do not skip a directory because it "looks like it doesn't matter." If you can't determine the depth, use `inspect`.

---

# Index Artifact Format

**Purpose**: Define the required structure of the codebase index artifact so every index is complete and consistent.

## 1. Required Sections

Every index artifact must include these sections in order:

### 1.1 Project Identity Card

| Field | Description |
|---|---|
| Project name | From README or package.json |
| Primary language | Detected from file extensions and build system |
| Framework(s) | Web framework, UI library, test framework, etc. |
| Build system | npm, pip, cargo, gradle, make, etc. |
| Package manager | npm, pip, yarn, cargo, go modules, etc. |
| Repo structure | Monorepo / single package / multi-repo |
| Line count | `find . -name '*.ext' | xargs wc -l` by language |
| File count | Total non-generated, non-vendored files |

### 1.2 Top-Level Directory Map

```
project-root/
├── src/                # source code
│   ├── core/           # business logic (inspect)
│   ├── api/            # HTTP handlers (inspect)
│   └── utils/          # utilities (catalog)
├── tests/              # test suite (catalog)
├── config/             # configuration (inspect)
├── docs/               # documentation (catalog)
└── scripts/            # build/deploy scripts (catalog)
```

Each entry shows the directory name, one-line purpose, and the exploration depth level used.

### 1.3 Entry Points

List every way the application can be started or invoked:

- CLI entry points (bin scripts, CLI commands)
- HTTP endpoints (routes, methods, handlers)
- Background jobs / workers / cron
- Exported library API surface
- Test entry points

For each entry point, document: file path, how it's invoked, what it does at a high level.

### 1.4 Configuration Inventory

Every config file, grouped by purpose:

| Purpose | Files |
|---|---|
| Build | tsconfig.json, webpack.config.js, Cargo.toml |
| Environment | .env, .env.example, config/*.yml |
| CI/CD | .github/workflows/*.yml, Jenkinsfile, Dockerfile |
| Lint/Format | .eslintrc, .prettierrc, rustfmt.toml |
| Editor | .editorconfig, .vscode/* |
| Deploy | docker-compose.yml, k8s/*, Terraform/* |

For each file, note: path, format (JSON/YAML/TOML/INI), and key settings relevant to understanding the project.

### 1.5 Module Dependency Map

List every module (directory containing code) and its dependencies:

```
Module: src/core/payments
Depends on: src/core/users, src/utils/validation
Used by: src/api/payments, src/workers/billing
```

For the full dependency graph, prefer a text-based tree or bullet list rather than ASCII diagrams.

### 1.6 Domain Model

Key entities, data structures, and their relationships:

```
User:
  - id: UUID
  - name: string
  - email: string
  - references: Account[], Order[]
  - defined in: src/core/users/model.ts

Account:
  - id: UUID
  - balance: Decimal
  - owner: User
  - defined in: src/core/accounts/model.ts
```

Include database tables, API request/response schemas, and internal data types.

### 1.7 External Dependency Audit

| Package | Version | Purpose | Used by |
|---|---|---|---|
| express | ^4.18 | HTTP framework | src/api/ |
| zod | ^3.22 | Validation | src/core/*, src/api/* |

Group by runtime vs dev dependency. Note any deprecated or unmaintained packages.

### 1.8 Test Strategy

| Aspect | Detail |
|---|---|
| Framework | jest, pytest, cargo test, etc. |
| Location | tests/, src/**/*.test.ts |
| Naming convention | *.test.ts, *.spec.ts, test_*.py |
| Coverage targets | Any thresholds in config |
| CI integration | Which tests run in CI |
| Test types | Unit, integration, e2e, snapshot |

### 1.9 Infrastructure Summary

- CI/CD pipeline: platform (GitHub Actions, GitLab CI, Jenkins) and stages
- Deployment: Docker, serverless, k8s, manual
- Hosting / cloud provider
- Monitoring / logging (if detectable)
- Any infrastructure-as-code files

### 1.10 Unknowns & Human Questions

List anything that was unclear, required judgment, or needs a human to confirm:

- "The purpose of `src/lib/legacy/` is unclear — looks like old migrations but no documentation."
- "The `.env.production` file is gitignored; values are unknown."
- "The `sendEmail` function in `src/core/notifications.ts` is called but never imported — possibly dead code."
- "CI/CD config references a `DEPLOY_KEY` secret; no further context found."

## 2. Section Format

Each section should follow this structure:

```markdown
### N. Section Title

**Summary**: One paragraph overview.

**Files examined**: [list of file paths explored]

**Findings**:
- Key point 1 (source: `path/to/file.ts:12-45`)
- Key point 2 (source: `path/to/file.ts:80-120`)

**Depth**: inspect / catalog / scan / skip
```

## 3. Output Path

The index artifact should be written to a path the agent and user can reference. Default to `CODEBASE_INDEX.md` in the project root if no path is specified. If the project root is not writable, write to the agent's session context and inform the user.

## 4. Updating

If the skill is invoked again on the same codebase, the agent should:
1. Read the existing `CODEBASE_INDEX.md`.
2. Note the git HEAD SHA at the time of the last index.
3. Diff against the current HEAD.
4. Update only the changed sections, preserving the rest.
5. Bump the "last indexed" timestamp.

---

# Verification

**Purpose**: Prove the codebase index is complete before marking the skill invocation as done.

## 1. Completeness Backstop

After all phases complete, run this check:

1. Collect every `import`, `require`, `use`, `include`, `from`, or equivalent statement discovered across all `inspect`-depth files.
2. Extract every file path or module name from those statements.
3. Verify each resolved path maps to a file that was actually read and cataloged in the index.
4. For any file that was **not** cataloged, add it to the index at the appropriate depth.
5. Repeat until no new files appear.

## 2. Verification Checklist

### Structural

- [ ] Every top-level directory (excluding `skip`-depth) is represented in the index.
- [ ] Every config file format expected for the detected language/framework is accounted for (e.g., if it's a Node project, `package.json`, `tsconfig.json`, `.eslintrc*`).
- [ ] All entry points (CLI, HTTP, workers, exported API) are documented.

### Dependencies

- [ ] Internal dependency graph is complete: every import/require is resolved to a file in the codebase or flagged as external.
- [ ] External dependency audit lists every package from every lock/manifest file.

### Tests

- [ ] Test directory or file naming convention is identified.
- [ ] Test framework is identified from config or test file contents.

### Data Flow

- [ ] All data models / schemas are discovered and summarized.
- [ ] API routes (if any) are enumerated with methods and handlers.

### Artifact Quality

- [ ] Index artifact follows the section order from `rules/artifact-format.md`.
- [ ] Every claim in the artifact cites a source file and line range.
- [ ] Unknowns / human questions are listed in a dedicated section.
- [ ] The artifact's "last indexed" timestamp is set.
- [ ] No placeholder text ("TODO", "TBD", "FIXME") remains in the artifact.

## 3. Blocker Handling

If a file or directory cannot be explored, document:

- Path of the blocked resource
- Reason (permission denied, binary format, missing external dependency, submodule not cloned)
- What would be needed to unblock it

Do not fabricate content for blocked resources. Mark them clearly as "blocked" in the index.

## 4. Self-Correction

If during verification you discover a gap:

1. Pause verification.
2. Go explore the missing area at the appropriate depth.
3. Append findings to the index artifact.
4. Resume verification from the beginning.

Do not skip gaps. Every gap must be resolved or documented as a blocker.

## 5. Exit Criteria

The skill invocation is complete when:

- [ ] All items in the verification checklist pass, or blockers are documented.
- [ ] The index artifact is written to the output path.
- [ ] Unknowns / human questions are flagged.
- [ ] The agent can answer "is there any file in this codebase you haven't read?" with "no, every file is cataloged."

---

# Codebase Index

> Index a codebase so thoroughly that nothing is left unknown.

Invoke this skill when you are dropped into an unfamiliar codebase and need to understand **every part of it** before making changes. It drives a structured, depth-first exploration that leaves no file, module, config, test, or data flow unexamined.

The output is a **codebase index artifact** — a durable reference the agent (and human) can consult for all future work.

<output_language>

All user-facing output (index artifact, summaries, reports, questions) defaults to English. Preserve source code identifiers, CLI commands, file paths, and config keys in their original form.

</output_language>

<purpose>

- Give agents a complete, verifiable mental model of an unfamiliar codebase.
- Ensure no file, directory, import, config, test, or data flow is overlooked.
- Produce a durable index artifact that survives across sessions.
- Document unknowns and human-clarification needs alongside findings.

</purpose>

<routing_rule>

Use `codebase-index` when the primary goal is **thoroughly understanding an existing codebase** — all of it, not just one module or one diff.

Do **not** use when:

- reviewing changes in a PR or branch (use `review`)
- diagnosing a specific bug (use `diagnosing-bugs`)
- designing a new module or interface (use `codebase-design`)
- teaching a concept or skill (use `teach`)

</routing_rule>

<instruction_contract>

| Field | Contract |
|---|---|
| Intent | Agent builds a complete, verifiable mental model of the entire codebase. |
| Trigger | User asks to index, onboard to, inventory, or exhaustively understand a codebase. |
| Scope | Reading and synthesis only — the agent may read any file but must not edit, delete, or write outside the output artifact path. |
| Authority | Project-level docs (README, AGENTS.md, CONTRIBUTING.md) outrank generic archetype patterns in `references/`. |
| Evidence | Every claim in the index artifact must cite its source file and line range. |
| Tools | Read, Glob, Grep, and Task (for parallel module exploration). No edit, write, or destructive tools. |
| Output | A markdown index artifact at a path the agent can reference. |
| Verification | Run the verification checklist in `rules/verification.md` before marking done. |
| Stop condition | Artifact passes verification, or a documented blocker prevents further exploration (missing deps, permission denied, user interrupt). |

</instruction_contract>

<activation_examples>

Positive requests:

- "Index this codebase so I understand every part of it."
- "Give me a complete onboarding to this project, leave nothing out."
- "I need to fully comprehend this codebase before I make any changes."
- "Walk me through every module, every config, and every test in this project."
- "Explore this repo exhaustively and tell me everything about it."

Negative requests:

- "Review the changes in my PR." → use `review`
- "Find the bug causing this crash." → use `diagnosing-bugs`

Boundary requests:

- "Explain the architecture of this project." → if user wants a high-level overview, ask whether they need the full index or just the big picture. Full index → trigger; overview only → route to quick explanation.
- "Tell me about the main module." → if they want one module, do a focused deep-dive on that module rather than the whole codebase; if they want context around it, trigger the full index.

</activation_examples>

<trigger_conditions>

| Situation | Mode |
|---|---|
| Agent has just entered an unfamiliar codebase and needs full understanding | full-index |
| User explicitly asks for codebase onboarding/indexing | full-index |
| User asks about a single module with explicit scope limit | focused-deep-dive |
| User asks for high-level overview only | boundary-handoff |

</trigger_conditions>

<workflow>

| Phase | Task | Output |
|---|---|---|
| 1 | **Surface Scan** — README, package.json, directory tree, language/framework detection, project type classification | Project identity card: name, language, framework, build system, repo structure (monorepo vs single package) |
| 2 | **Config & Entry Points** — build configs, environment files, routing, CLI entry points, main/index files | Config inventory and entry-point map |
| 3 | **Dependency Map** — trace internal module dependency graph (import/require chains), audit external dependencies | Internal module dependency map + external dependency audit |
| 4 | **Domain & Data Flow** — key entities, data models, API contracts, state management, cross-module data flow | Domain model map and data flow description |
| 5 | **Testing & Infra** — test framework, test patterns, CI/CD config, deployment, Docker, infra-as-code | Test strategy summary and infra inventory |
| 6 | **Synthesis** — produce the index artifact, run the completeness check, flag unknowns for human | Final codebase index artifact |

Phases 2–5 can run as parallel sub-agents when the codebase is large (see `rules/exploration-depth.md` for thresholds).

After Phase 6, the agent must run the **completeness backstop**: trace every import/require chain discovered in Phase 3 and verify each referenced file was explored. Any untouched file must be added to the index before completion.

### Next-file read order

1. `rules/exploration-depth.md` — before starting Phase 1, to set depth expectations
2. `rules/artifact-format.md` — before Phase 6, to shape the output
3. `rules/verification.md` — before declaring completion
4. `references/codebase-archetypes.md` — during Phase 1 if the project type is unclear

</workflow>

<required>

| Category | Required |
|---|---|
| Completeness | Every directory, file, config, test, and script must be cataloged. |
| Traceability | Every claim cites its source file and line range. |
| Depth | Follow `rules/exploration-depth.md` — do not stop at surface inspection. |
| Artifact | Produce a structured index artifact following `rules/artifact-format.md`. |
| Verification | Run `rules/verification.md` checklist before marking done. |
| Unknowns | Document unresolved questions and areas needing human input. |

</required>

<forbidden>

| Category | Avoid |
|---|---|
| Edits | Do not modify any source file. Read-only mode. |
| Omissions | Do not skip files because they look "unimportant" — every file gets cataloged. |
| Guesswork | If a file's purpose is unclear, say so rather than guessing. |
| Over-abstraction | Summarize groups of files, but also list every file individually in the index. |
| Run-time side effects | No `npm install`, `composer install`, `docker build`, or other side-effecting commands. |

</forbidden>

<validation>

Must-pass thresholds:

- [ ] All top-level directories are listed and summarized.
- [ ] Every config file is identified (build, CI/CD, env, lint, editor, deploy).
- [ ] Every entry point is identified and traced.
- [ ] Internal dependency graph is complete: every import/require resolved.
- [ ] Test structure is documented (framework, location, naming convention).
- [ ] External dependencies are audited (package managers, registries, lock files).
- [ ] Index artifact covers all required sections from `rules/artifact-format.md`.
- [ ] Completeness backstop ran: no import references an unexplored file.
- [ ] Unknowns and human-clarification items are listed separately.
- [ ] Verification checklist from `rules/verification.md` is passed.

</validation>

---

# Codebase Archetypes

**Purpose**: Common exploration patterns for different project types. Use this during Phase 1 (Surface Scan) to guide what to look for.

## Web Application (Node/React/Next.js)

**Look for**:
- `pages/` or `app/` directory (Next.js routing)
- `src/routes/` or `src/controllers/` (Express/Fastify)
- `components/`, `hooks/`, `providers/` (React)
- `middleware/` or `middlewares/`
- API client layer (`src/api/`, `src/services/`)
- State management (`store/`, `state/`, `reducers/`, `atoms/`)
- Database access (`prisma/`, `drizzle/`, `models/`, `repositories/`)
- Authentication (`auth/`, `session/`, `passport/`, `next-auth/`)
- Environment variables and `.env` files

**Configs to expect**: `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, `package.json`

## Web Application (Python/Django/FastAPI)

**Look for**:
- Django: `urls.py`, `views.py`, `models.py`, `serializers.py`, `admin.py`, `settings.py`
- FastAPI: `main.py`, `routers/`, `schemas/`, `dependencies/`, `database.py`
- Flask: `app.py`, `blueprints/`, `models.py`
- `migrations/` or `alembic/` for DB migrations
- `tests/` or `conftest.py`
- `requirements.txt`, `pyproject.toml`, `setup.py`, `Pipfile`

**Configs to expect**: `pyproject.toml`, `setup.cfg`, `.flake8`, `pytest.ini`, `Dockerfile`

## Library / Package

**Look for**:
- Public API surface: `index.ts`, `__init__.py`, `lib.rs`, `main.go`
- Type definitions: `.d.ts` files, `typings/`, `types/`
- Entry point in `package.json` (`main`, `module`, `types`, `exports`)
- Build output config: `tsconfig.json` outDir, `setup.py` packages
- README examples — these are the "interface" the library exposes
- Test files showing usage patterns

**Configs to expect**: `package.json`, `tsconfig.json`, `.npmignore`, `LICENSE`

## Monorepo

**Look for**:
- Workspace config: `package.json#workspaces`, `pnpm-workspace.yaml`, `Cargo.toml#workspace`, `lerna.json`, `turbo.json`, `nx.json`
- `packages/`, `apps/`, `libs/`, `modules/` directories
- Shared configs at root level (`tsconfig.base.json`, `.eslintrc.js`)
- Tooling: Turborepo, Nx, Lerna, Yarn workspaces, pnpm workspaces
- Internal package dependencies (`@company/package-name`)

**Index each package/app individually** following the same phases, then produce a cross-package dependency map.

## CLI Tool

**Look for**:
- Entry point: `bin/` directory, `package.json#bin`, `console_scripts` in setup.py
- Argument parsing: `commander`, `yargs`, `click`, `argparse`, `clap`
- Command hierarchy: subcommands, flags, positional args
- Configuration loading: `.config/`, `~/.config/`, environment variables
- Output formatting: stdout/stderr handling, color output, progress bars
- Error handling: exit codes, error messages

**Configs to expect**: None or minimal — CLI tools often have no project-level config.

## Docker / Infrastructure Project

**Look for**:
- `Dockerfile`, `docker-compose.yml`, `docker-compose.override.yml`
- `k8s/`, `kubernetes/`, `helm/` directories
- `terraform/`, `pulumi/`, `cdk/` directories
- `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`
- `Makefile`, `Taskfile.yml`, `Justfile`
- `.env`, `.env.example`, `.env.*` files
- Service mesh / ingress configs (nginx, traefik, envoy)
- Monitoring configs (prometheus, grafana, datadog)

**Focus**: Infrastructure is connective tissue — trace every service name, port, volume, and secret reference back to the application code it serves.

## When Archetypes Overlap

If the codebase matches multiple archetypes (e.g., a monorepo containing a web app and a CLI tool), index each archetype area separately and then build a cross-area map showing how they connect.
