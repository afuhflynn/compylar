# OpenAI Build Week MVP Plan

## 1. Goal

Build a working hackathon MVP of Compylar for the OpenAI Build Week Developer Tools track.

The MVP should prove one idea clearly:

> A repository can be compiled into persistent engineering knowledge, and that knowledge can be reused to give Codex better task-specific context.

This is not the full Compylar platform. It is the smallest credible implementation of the Knowledge Compiler concept.

## 2. Hackathon Context

OpenAI Build Week requires:

- a working project
- use of Codex and GPT-5.6
- a project category
- a project description
- a public demo video under 3 minutes
- a code repository
- README setup instructions
- explanation of how Codex and GPT-5.6 were used
- `/feedback` Codex Session ID for the main build session

Recommended category:

**Developer Tools**

Submission deadline:

**Tuesday, July 21, 2026 at 5:00 PM PT**

## 3. MVP Positioning

Compylar is a Knowledge Compiler for AI coding agents.

Instead of asking Codex to rediscover the repository every session, Compylar compiles the repository into a reusable Repository Brain. Then, when a developer gives Codex a task, Compylar generates a compact context pack containing only the files, architecture notes, and constraints relevant to that task.

Demo message:

> Codex is powerful, but every coding agent wastes time rediscovering the codebase. Compylar fixes that by compiling repository knowledge once and reusing it across tasks.

## 4. MVP Scope

### In Scope

- Local TypeScript CLI
- TypeScript/Next.js repository support
- Repository scan and compile
- Package/script extraction
- Route and API handler detection
- Import/export graph extraction
- Basic module graph
- Repository Brain summary
- Task-specific context pack generation
- GPT-assisted architecture and context summaries
- Change detection with file fingerprints
- Example repository or fixture for demo
- README and demo script

### Out of Scope

- Web dashboard
- Hosted SaaS
- Billing
- organizations
- authentication
- full MCP server
- multi-language support
- background workers
- enterprise permissions
- full incremental recompilation
- automatic pull request creation
- complete long-term EDS generation

## 5. Technical Stack

### Core

- Node.js
- TypeScript
- npm package scripts

### CLI

- Commander.js for command routing
- Chalk for readable terminal output
- Ora for progress spinners
- Boxen or cli-table3 for readable summaries

### Repository Analysis

- ts-morph for TypeScript AST analysis
- fast-glob or globby for file discovery
- minimatch for ignore rules
- git command integration for fingerprints and diffs where useful

### Storage

Preferred:

- SQLite using better-sqlite3

Fallback if time is tight:

- JSON files under `.compylar/`

### Validation

- Zod for schema validation

### AI Integration

- OpenAI TypeScript SDK
- Responses API
- Configurable model via `OPENAI_MODEL`
- Default model should target the hackathon-required GPT-5.6 where available

### Testing

- Vitest
- Fixture TypeScript/Next.js repo

## 6. CLI Commands

### `compylar init`

Initializes Compylar state in the current repository.

Creates:

- `.compylar/`
- `.compylar/config.json`
- `.compylar/brain.db` or `.compylar/brain.json`

### `compylar compile <repoPath>`

Compiles a repository into a Repository Brain.

Responsibilities:

- scan supported files
- parse package metadata
- detect Next.js routes
- detect API handlers
- extract imports and exports
- identify important modules
- build dependency graph
- calculate file fingerprints
- call GPT for architecture summary
- persist compiled knowledge

### `compylar brain`

Prints a readable Repository Brain summary.

Should show:

- repository name
- framework guess
- main scripts
- route summary
- API summary
- module summary
- important dependencies
- architecture summary
- risks or missing information

### `compylar context "<task>"`

Generates a task-specific context pack for Codex or another coding agent.

Should output:

- interpreted task
- relevant files
- relevant modules
- architecture notes
- implementation constraints
- recommended next steps
- excluded irrelevant areas

### `compylar diff`

Reports what changed since the last compile.

Should show:

- changed files
- deleted files
- added files
- likely stale knowledge areas
- recommendation to re-run compile

## 7. Data Model

### RepositoryBrain

```ts
type RepositoryBrain = {
  repo: {
    name: string;
    rootPath: string;
    framework: "nextjs" | "typescript" | "unknown";
  };
  compiledAt: string;
  fingerprint: string;
  packageInfo: PackageInfo;
  files: RepositoryFile[];
  routes: RouteInfo[];
  apiHandlers: ApiHandlerInfo[];
  modules: ModuleInfo[];
  dependencyGraph: DependencyEdge[];
  architectureSummary?: string;
};
```

### ContextPack

```ts
type ContextPack = {
  task: string;
  generatedAt: string;
  taskSummary: string;
  selectedFiles: SelectedFile[];
  relevantModules: string[];
  architectureNotes: string[];
  agentInstructions: string[];
  excludedContext: string[];
};
```

## 8. Implementation Sequence

### Step 1: Project Setup

- Initialize npm package
- Add TypeScript
- Add CLI entrypoint
- Add lint/test/build scripts
- Add README skeleton

### Step 2: CLI Skeleton

- Implement `compylar` binary
- Add commands:
  - `init`
  - `compile`
  - `brain`
  - `context`
  - `diff`

### Step 3: Repository Scanner

- Implement file discovery
- Apply ignore rules
- Read package.json
- Detect Next.js conventions
- Store file metadata and hashes

### Step 4: TypeScript Analyzer

- Use ts-morph to parse TypeScript files
- Extract imports
- Extract exports
- Build dependency edges
- Detect modules and entrypoints

### Step 5: Repository Brain Storage

- Persist compiled knowledge
- Load compiled knowledge for later commands
- Validate stored data with Zod

### Step 6: Brain Summary

- Generate deterministic summary
- Add GPT-assisted architecture summary
- Make output readable in terminal

### Step 7: Context Builder

- Accept a natural-language task
- Rank relevant files by:
  - direct path/name matches
  - route/module matches
  - dependency proximity
  - package/framework relevance
- Ask GPT to synthesize compact agent instructions
- Output markdown context pack

### Step 8: Diff Detection

- Compare current file hashes with stored hashes
- Report added/changed/deleted files
- Mark affected modules as stale

### Step 9: Demo Polish

- Add sample repo or fixture
- Add `npm run demo`
- Write README setup
- Write demo script
- Record under-3-minute video

## 9. Demo Script

### Opening

“This is Compylar, a Knowledge Compiler for AI coding agents. Coding agents are powerful, but they repeatedly rediscover the same repository. Compylar compiles repo knowledge once and reuses it.”

### Flow

1. Show a TypeScript/Next.js repo.
2. Run `compylar compile ./example`.
3. Show routes, modules, dependencies, and architecture summary.
4. Run `compylar context "add authentication to the dashboard"`.
5. Show the generated context pack.
6. Explain that Codex can now start with targeted context instead of scanning everything.
7. Make or show a small Codex-assisted code change.
8. Run `compylar diff`.
9. Show changed files and stale knowledge areas.

### Closing

“The MVP is local and focused, but the long-term vision is a Repository Brain that survives sessions, models, IDEs, and agents.”

## 10. Acceptance Criteria

The MVP is ready when:

- `npm install` works
- `npm run build` works
- `npm test` works
- CLI can compile a sample TypeScript/Next.js repo
- CLI can print a Repository Brain
- CLI can generate a task-specific context pack
- CLI can detect changed files
- README explains setup and demo
- demo video is under 3 minutes
- project description clearly explains Codex and GPT usage

## 11. README Requirements

The README should include:

- what Compylar is
- why repository knowledge should be compiled
- install instructions
- OpenAI environment variable setup
- CLI commands
- demo walkthrough
- architecture overview
- limitations
- how Codex was used
- how GPT-5.6 was used
- future roadmap

## 12. Submission Description Draft

Compylar is a Knowledge Compiler for AI coding agents.

Instead of forcing Codex and other agents to rediscover a codebase every session, Compylar compiles a repository into a persistent Repository Brain. The MVP analyzes TypeScript/Next.js projects, extracts routes, modules, dependencies, package metadata, and architecture signals, then uses GPT-5.6 to synthesize compact task-specific context packs for coding agents.

The result is less wasted context, lower token usage, faster onboarding to unfamiliar repositories, and better first-pass agent performance.

For OpenAI Build Week, the project focuses on a local CLI that demonstrates the core workflow: compile a repo, inspect the Repository Brain, generate context for a task, and detect stale knowledge after code changes.

## 13. Risks and Mitigations

### Risk: Scope creep

Mitigation:

Keep the MVP local, CLI-first, and TypeScript/Next.js only.

### Risk: Too much AI, not enough deterministic implementation

Mitigation:

Use deterministic parsing for repository facts and GPT only for summaries/context synthesis.

### Risk: Demo unclear

Mitigation:

Show one concrete task and one clear before/after context pack.

### Risk: GPT-5.6 access or naming issues

Mitigation:

Make the model configurable through `OPENAI_MODEL` and document the expected hackathon model.

### Risk: Repository analysis too shallow

Mitigation:

Focus on high-signal Next.js facts: routes, API handlers, imports, exports, scripts, and dependencies.

## 14. Final Build Priority

If time is limited, prioritize in this order:

1. Working CLI
2. Compile command
3. Repository Brain output
4. Context pack generation
5. README
6. Demo fixture
7. Diff command
8. Tests
9. Terminal polish

The project must be working and understandable before it is feature-rich.
