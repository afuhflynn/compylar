#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import fs from "node:fs/promises";
import { compileRepository } from "./analyzer.js";
import { buildContextResult, contextMarkdown } from "./context.js";
import { enrichContext } from "./ai.js";
import {
  loadBrain,
  listSnapshots,
  saveBrain,
  saveConfig,
  stateDir,
} from "./storage.js";
import { RepositoryBrain } from "./types.js";
import {
  analyticsTable,
  brainReport,
  buildAnalytics,
  conciseSummary,
  memoryRefreshSummary,
} from "./analytics.js";
import { createProgressController, type ProgressMode } from "./progress.js";
import { runDemo } from "./demo.js";
import { reconcileSemanticIndex, repositoryBootstrap, repositoryCommitMemory, repositoryCompileDiff, repositoryFacts, repositoryIngestIndex, repositoryLearn, repositoryLearned, repositoryLookup, repositoryMemoryReview, repositoryOverview, repositoryReferences, repositoryRefresh, repositoryRoutes, repositoryStatus, repositorySync, repositorySystems } from "./services.js";
import { COMPYLAR_VERSION } from "./version.js";
import { loadConfig } from "./config.js";
import { reconcileLearnedMemory, reconcileMemory } from "./memory.js";
import {
  applyAgentInstall,
  applyAgentSetup,
  createAgentInstallPlan,
  createAgentSetupPlan,
  supportedAgents,
  type SupportedAgent,
} from "./agent-install.js";

const rootOf = (value?: string) => path.resolve(value ?? ".");
const outputOptions = (command: Command) =>
  command
    .option("--json", "print machine-readable JSON")
    .option("--no-color", "disable color output");

const compileOptions = (command: Command) =>
  outputOptions(command)
    .option("--resume", "reuse unchanged files from the last Brain")
    .option("--no-ai", "skip OpenAI enrichment")
    .option("--quiet", "suppress progress output")
    .option(
      "--progress <mode>",
      "progress output: auto, interactive, plain, json, or none",
      "auto",
    )
    .option("--analytics", "print the detailed analytics table after compiling")
    .option("--max-files <number>", "maximum source files")
    .option("--max-file-size <bytes>", "maximum individual file size")
    .option("--max-total-bytes <bytes>", "maximum total source bytes")
    .option("--timeout <milliseconds>", "AI request timeout");

const print = (value: unknown, json: boolean, human: () => void) =>
  json ? console.log(JSON.stringify(value, null, 2)) : human();

// Initialize Command
const program = new Command()
  .name("compylar")
  .description("Compile trustworthy repository knowledge for AI coding agents")
  .version(COMPYLAR_VERSION)
  .showSuggestionAfterError();
outputOptions(
  program
    .command("bootstrap")
    .description("Create a local baseline and return the required agent-led semantic indexing workflow")
    .argument("[path]", "repository path", "."),
).action(async (value, options) => {
  const result = await repositoryBootstrap(rootOf(value), { ai: false, progress: false });
  print(result, options.json, () => {
    console.log(result.message);
    console.log(`Next: ${result.nextAction}`);
    console.log(`Required memory: ${result.requiredFindings.join(", ")}`);
  });
});
outputOptions(
  program
    .command("setup-agent")
    .description("Preview or install the Compylar skill plus a short always-on project trigger")
    .argument("[path]", "repository path", ".")
    .requiredOption("--agent <agent>", "agent: codex, claude, or opencode")
    .option("--scope <scope>", "installation scope (project only)", "project")
    .option("--replace-skill", "replace an existing skill after saving a timestamped backup")
    .option("--apply", "install after showing the explicit plan"),
).action(async (value, options) => {
  if (!supportedAgents.includes(options.agent as SupportedAgent)) throw new Error(`Unsupported agent ${JSON.stringify(options.agent)}. Choose one of: ${supportedAgents.join(", ")}.`);
  if (options.scope !== "project") throw new Error("Only project scope is supported.");
  const plan = await createAgentSetupPlan({ root: rootOf(value), agent: options.agent as SupportedAgent, scope: "project" });
  const result = options.apply ? await applyAgentSetup(plan, options.replaceSkill === true) : plan;
  print(result, options.json, () => {
    console.log(`Skill: ${result.state} → ${result.destination}`);
    console.log(`Always-on trigger: ${result.instruction.state} → ${result.instruction.destination}`);
    if (result.instruction.state === "conflict") console.log("No files changed: merge the trigger into the existing instruction file manually.");
    else if (!options.apply) console.log("No files changed: run again with --apply after reviewing the plan.");
  });
});
outputOptions(
  program
    .command("sync")
    .description("Plan the smallest trustworthy agent re-index scope for stale repository memory")
    .argument("[path]", "repository path", "."),
).action(async (value, options) => {
  const result = await repositorySync(rootOf(value));
  print(result, options.json, () => {
    console.log(`Sync action: ${result.action}`);
    if ("reason" in result) console.log(result.reason);
    if (result.changedPaths.length) console.log(`Changed: ${result.changedPaths.join(", ")}`);
    if (result.affectedPaths.length) console.log(`Inspect: ${result.affectedPaths.join(", ")}`);
    if (result.requiredFindings.length) console.log(`Update memory: ${result.requiredFindings.join(", ")}`);
  });
});
outputOptions(
  program
    .command("overview")
    .description("Return the compact deterministic repository profile")
    .argument("[path]", "repository path", "."),
).action(async (value, options) => {
  const overview = await repositoryOverview(rootOf(value));
  print(overview, options.json, () => {
    console.log(overview.summary);
    console.log(`\nStack: ${overview.stack.join(", ") || "not deterministically identified"}`);
    console.log("\nDirectories:");
    for (const directory of overview.directories) console.log(`  ${directory.path}: ${directory.purpose}`);
    if (overview.unknowns.length) console.log(`\nUnknowns: ${overview.unknowns.join(" ")}`);
  });
});
program
  .command("demo")
  .description("Run the packaged end-to-end demonstration in a temporary directory")
  .action(async () => {
    await runDemo();
  });
program
  .command("init")
  .description("Initialize Compylar state in a repository")
  .argument("[path]", "repository path", ".")
  .action(async (value) => {
    const root = rootOf(value);
    await saveConfig(root);
    console.log(chalk.green(`Initialized Compylar in ${stateDir(root)}`));
    console.log("Next: compylar compile .");
  });
outputOptions(
  program
    .command("install-agent")
    .description("Preview or install the portable Compylar skill for one agent")
    .argument("[path]", "repository path", ".")
    .requiredOption("--agent <agent>", "agent: codex, claude, or opencode")
    .option("--scope <scope>", "installation scope (project only)", "project")
    .option("--check", "compare the bundled skill with an existing destination")
    .option("--replace", "replace an existing skill after saving a timestamped backup")
    .option("--apply", "copy the skill after showing the explicit plan"),
).action(async (value, options) => {
  if (!supportedAgents.includes(options.agent as SupportedAgent)) {
    throw new Error(
      `Unsupported agent ${JSON.stringify(options.agent)}. Choose one of: ${supportedAgents.join(", ")}.`,
    );
  }
  if (options.scope !== "project") {
    throw new Error(
      "Only project scope is supported. Compylar never writes personal or global agent configuration implicitly.",
    );
  }
  const plan = await createAgentInstallPlan({
    root: rootOf(value),
    agent: options.agent as SupportedAgent,
    scope: "project",
  });
  if (options.replace && !options.apply) throw new Error("--replace requires --apply.");
  const result = options.apply ? await applyAgentInstall(plan, options.replace === true) : plan;
  print(result, options.json, () => {
    console.log(
      result.state === "installed"
        ? chalk.green(`Installed Compylar skill for ${result.agent}.`)
        : result.state === "conflict"
          ? chalk.yellow("No files changed: an existing skill needs review.")
          : "No files changed: this is an installation preview.",
    );
    console.log(`Source: ${result.source}`);
    console.log(`Destination: ${result.destination}`);
    if ("comparison" in result && result.comparison) console.log(`Existing skill: ${result.comparison}`);
    if ("backupPath" in result && result.backupPath) console.log(`Previous skill backed up to: ${result.backupPath}`);
    if (result.state === "ready")
      console.log("Run again with --apply to copy this skill.");
    if (result.state === "conflict")
      console.log("Remove or rename the existing skill yourself before applying.");
  });
});

compileOptions(
  program
    .command("compile")

    .alias("c")
    .description(
      "Analyze a repository and create a successful knowledge baseline",
    )
    .argument("[path]", "repository path", "."),
).action(async (value, options) => {
  const root = rootOf(value);
  const numeric = (value: string | undefined) =>
    value === undefined ? undefined : Number(value);
  const controller = new AbortController();
  const progressMode: ProgressMode = options.quiet
    ? "none"
    : (options.progress as ProgressMode);
  const progressController = createProgressController(progressMode);
  process.once("SIGINT", () => {
    controller.abort();
    progressController.fail(
      "Cancellation requested; finishing the current file",
    );
  });
  try {
    const previous = await loadBrain(root).catch(() => undefined);
    const brain = await compileRepository(root, {
      ai: options.ai === false ? false : undefined,
      resume: Boolean(options.resume),
      progress: progressMode !== "none",
      onProgress: progressController.reporter,
      maxFiles: numeric(options.maxFiles),
      maxFileSize: numeric(options.maxFileSize),
      maxTotalBytes: numeric(options.maxTotalBytes),
      timeoutMs: numeric(options.timeout),
      signal: controller.signal,
    });
    if (previous) {
      brain.memory = reconcileMemory(brain, previous.memory);
      brain.learnedMemory = {
        schemaVersion: 1,
        findings: reconcileLearnedMemory(brain, previous.learnedMemory?.findings),
      };
      brain.semanticIndex = reconcileSemanticIndex(brain, previous.semanticIndex);
    }
    if (brain.status !== "cancelled") await saveBrain(root, brain);
    progressController.complete();
    print(brain, options.json, () => {
      console.log(conciseSummary(brain));
      if (options.analytics) console.log(`\n${analyticsTable(brain)}`);
      if (brain.ai.status === "failed" || brain.ai.status === "timed-out")
        console.log(
          `AI enrichment: ${brain.ai.status} — deterministic facts remain valid.`,
        );
    });
  } catch (error) {
    progressController.fail(
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    progressController.dispose();
  }
});
outputOptions(
  program
    .command("ingest-index")
    .description("Validate and ingest the bundled codebase-index semantic manifest")
    .argument("[path]", "repository path", ".")
    .option("--manifest <path>", "semantic manifest path (defaults to .compylar/semantic-index.json)"),
).action(async (value, options) => {
  const result = await repositoryIngestIndex(rootOf(value), options.manifest);
  print(result, options.json, () => {
    console.log(`Semantic memory: ${result.status}`);
    console.log(`Findings: ${result.created} created · ${result.reused} reused`);
    console.log(`Coverage: ${result.coverage.join(", ")}`);
    if (result.blockers.length) console.log(`Blockers: ${result.blockers.join("; ")}`);
  });
});
compileOptions(
  program
    .command("refresh")
    .description("Refresh stale knowledge, reusing unchanged source analysis")
    .argument("[path]", "repository path", "."),
).action(async (value, options) => {
  const root = rootOf(value);
  const numeric = (input: string | undefined) =>
    input === undefined ? undefined : Number(input);
  const progressMode: ProgressMode = options.quiet
    ? "none"
    : (options.progress as ProgressMode);
  const progressController = createProgressController(progressMode);
  try {
    const result = await repositoryRefresh(root, {
      ai: options.ai === false ? false : undefined,
      progress: progressMode !== "none",
      onProgress: progressController.reporter,
      maxFiles: numeric(options.maxFiles),
      maxFileSize: numeric(options.maxFileSize),
      maxTotalBytes: numeric(options.maxTotalBytes),
      timeoutMs: numeric(options.timeout),
    });
    progressController.complete();
    print(result, options.json, () => {
      if (!result.refreshed) {
        console.log(chalk.green("Knowledge is current; nothing to refresh."));
        return;
      }
      console.log(conciseSummary(result.brain!));
      console.log(
        chalk.dim(
          `Refreshed ${[...result.before.added, ...result.before.changed, ...result.before.deleted].length} changed path(s); unchanged source analysis was reused.`,
        ),
      );
      console.log(chalk.dim(memoryRefreshSummary(result.brain!)));
      if (options.analytics) console.log(`\n${analyticsTable(result.brain!)}`);
    });
  } catch (error) {
    progressController.fail(
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    progressController.dispose();
  }
});
const brainCommand = outputOptions(
  program
    .command("brain")
    .description("Explain the latest compiled Repository Brain")
    .argument("[path]", "repository path", ".")
    .option("--routes", "include the formatted route table")
    .option(
      "--dependencies",
      "include dependency summaries and unresolved imports",
    )
    .option(
      "--full",
      "include all expanded route, dependency, and diagnostic inventories",
    ),
);
brainCommand.action(async (value, options) => {
  const brain = await loadBrain(rootOf(value));
  print(brain, options.json, () => {
    console.log(brainReport(brain, options));
  });
});
function parseCitation(value: string) {
  const match = value.match(/^(.*):(\d+)(?:-(\d+))?$/);
  if (!match) throw new Error("Source citation must be path:startLine-endLine (for example lib/auth.ts:10-34).");
  return { path: match[1], startLine: Number(match[2]), endLine: Number(match[3] ?? match[2]) };
}
function learningCommand(name: "learn" | "remember", authority: "agent" | "human") {
  return outputOptions(
    program.command(name)
      .description(authority === "human" ? "Record a human-authoritative repository decision or note" : "Record a cited, durable repository discovery")
      .argument("<summary>", "concise durable finding")
      .argument("[path]", "repository path", ".")
      .requiredOption("--kind <kind>", "flow, system, constraint, convention, gotcha, decision, task-outcome, or unknown")
      .option("--source <citation...>", "source citation path:startLine-endLine; required for agent learning")
      .option("--question <question>", "question that led to this finding")
      .option("--confidence <confidence>", "high, medium, or low")
      .option("--system <name...>", "architecture system(s) this fact belongs to")
      .option("--key <key>", "stable key; supersedes the current fact with the same key"),
  ).action(async (summary, value, options) => {
    const kinds = ["flow", "system", "constraint", "convention", "gotcha", "decision", "task-outcome", "unknown"] as const;
    if (!kinds.includes(options.kind)) throw new Error(`Learning kind must be one of: ${kinds.join(", ")}.`);
    if (options.confidence && !["high", "medium", "low"].includes(options.confidence)) throw new Error("Confidence must be high, medium, or low.");
    const finding = await repositoryLearn(rootOf(value), {
      kind: options.kind,
      summary,
      authority,
      sources: (options.source ?? []).map(parseCitation),
      originQuestion: options.question,
      confidence: options.confidence,
      systems: options.system,
      stableKey: options.key,
    });
    print(finding, options.json, () => console.log(`Recorded ${finding.kind} memory: ${finding.id}`));
  });
}
learningCommand("learn", "agent");
learningCommand("remember", "human");
outputOptions(
  program.command("memory-review")
    .description("Prepare the required durable-memory review after deep repository work")
    .argument("<task>", "work that was investigated or implemented")
    .argument("[path]", "repository path", ".")
    .option("--files <paths...>", "source files read during deep work")
    .option("--changed <paths...>", "source files changed during work"),
).action(async (task, value, options) => {
  const result = await repositoryMemoryReview(rootOf(value), task, options.files ?? [], options.changed ?? []);
  print(result, options.json, () => {
    console.log(`Memory review: ${result.requiresReview ? "required" : "not required"}`);
    console.log(`Systems: ${result.systems.join(", ") || "none yet"}`);
    console.log(`Uncovered: ${result.uncovered.join(", ") || "none"}`);
    console.log("Commit a cited manifest with: compylar commit-memory . --manifest <path>");
  });
});
outputOptions(
  program.command("commit-memory")
    .description("Validate and atomically persist a cited post-work memory delta")
    .argument("[path]", "repository path", ".")
    .requiredOption("--manifest <path>", "JSON manifest from memory-review"),
).action(async (value, options) => {
  const raw = JSON.parse(await fs.readFile(options.manifest, "utf8"));
  const result = await repositoryCommitMemory(rootOf(value), raw);
  print(result, options.json, () => console.log(`Committed ${result.committed} durable memory record(s) for: ${result.task}`));
});
outputOptions(
  program.command("systems")
    .description("List current system-scoped architecture memory")
    .argument("[path]", "repository path", ".")
    .option("--query <term>", "filter system name"),
).action(async (value, options) => {
  const result = await repositorySystems(rootOf(value), options.query);
  print(result, options.json, () => {
    if (!result.length) console.log("No system-scoped architecture memory exists yet.");
    for (const system of result) console.log(`${system.name}: ${system.findings.length} finding(s) · ${system.coverage.join(", ") || "no coverage"}`);
  });
});
function factCommand(name: "setup" | "env" | "schema" | "jobs" | "actions", kinds: Parameters<typeof repositoryFacts>[1]) {
  return outputOptions(program.command(name).description(`List verified ${name} facts without reopening source files`).argument("[path]", "repository path", ".").option("--query <term>", "filter facts")).action(async (value, options) => {
    const result = await repositoryFacts(rootOf(value), kinds, options.query);
    print(result, options.json, () => result.length ? result.forEach((fact) => console.log(`${fact.name}\n  ${fact.summary}\n  ${fact.source}:${fact.line}`)) : console.log(`No verified ${name} facts matched.`));
  });
}
factCommand("setup", ["setup", "documentation"]);
factCommand("env", ["environment"]);
factCommand("schema", ["schema"]);
factCommand("jobs", ["job"]);
factCommand("actions", ["server-action"]);
outputOptions(
  program
    .command("analytics")
    .description("Display detailed metrics from the latest Repository Brain")
    .argument("[path]", "repository path", "."),
).action(async (value, options) => {
  const brain = await loadBrain(rootOf(value));
  print(buildAnalytics(brain), options.json, () => {
    console.log(`${chalk.bold(`${brain.repo.name} — Compile analytics`)}\n`);
    console.log(analyticsTable(brain));
  });
});
outputOptions(
  program
    .command("memory")
    .description("Look up compact, evidence-backed repository facts")
    .argument("<query>", "symbol, route, module, or memory query")
    .argument("[path]", "repository path", ".")
    .option("--exact", "return exact matches only")
    .option("--kind <kind>", "symbol, prisma, learned, memory, route, or fact")
    .option("--limit <number>", "maximum results", "8")
    .option("--full", "include bounded stored declarations"),
).action(async (query, value, options) => {
  const limit = Number(options.limit);
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("Memory limit must be a positive integer.");
  const kinds = ["symbol", "prisma", "learned", "memory", "route", "fact"] as const;
  if (options.kind && !kinds.includes(options.kind)) throw new Error(`Memory kind must be one of: ${kinds.join(", ")}.`);
  const result = await repositoryLookup(rootOf(value), query, undefined, { exact: options.exact === true, kind: options.kind, limit, full: options.full === true });
  print(result, options.json, () => {
    if (!result.matches.length) {
      console.log(`No evidence-backed memory matched ${JSON.stringify(query)}.`);
      return;
    }
    for (const match of result.matches) {
      console.log(`${match.kind} · ${match.match} · ${match.name}`);
      console.log(`  ${match.definition}`);
      console.log(`  ${match.source}${match.line ? `:${match.line}` : ""} · ${match.confidence} confidence`);
    }
  });
});
outputOptions(
  program.command("learned")
    .description("List and audit durable learned repository findings")
    .argument("[path]", "repository path", ".")
    .option("--query <text>", "filter finding id, kind, or summary")
    .option("--state <state>", "current, stale, superseded, or archived")
    .option("--limit <number>", "maximum findings", "40"),
).action(async (value, options) => {
  const limit = Number(options.limit);
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("Learned limit must be a positive integer.");
  const states = ["current", "stale", "superseded", "archived"] as const;
  if (options.state && !states.includes(options.state)) throw new Error(`Learned state must be one of: ${states.join(", ")}.`);
  const findings = await repositoryLearned(rootOf(value), { query: options.query, state: options.state, limit });
  print(findings, options.json, () => findings.forEach((finding) => console.log(`${finding.id}\n  ${finding.state} · ${finding.summary}`)));
});
outputOptions(
  program.command("references")
    .description("Show proven callers, tests, and guards for an exact symbol")
    .argument("<symbol>", "exact symbol name")
    .argument("[path]", "repository path", "."),
).action(async (symbol, value, options) => {
  const result = await repositoryReferences(rootOf(value), symbol);
  print(result, options.json, () => console.log(JSON.stringify(result, null, 2)));
});
outputOptions(
  program.command("compile-diff")
    .description("Compare two stored Repository Brain snapshots without rereading source")
    .argument("[path]", "repository path", ".")
    .option("--from <id>", "older snapshot id")
    .option("--to <id>", "newer snapshot id"),
).action(async (value, options) => {
  const number = (input: string | undefined) => input === undefined ? undefined : Number(input);
  const result = await repositoryCompileDiff(rootOf(value), number(options.from), number(options.to));
  print(result, options.json, () => console.log(JSON.stringify(result, null, 2)));
});
outputOptions(
  program
    .command("routes")
    .description("List verified routes without reopening source files")
    .argument("[path]", "repository path", ".")
    .option("--filter <text>", "match route path, file, or package")
    .option("--area <area>", "match the top-level route area")
    .option("--kind <kind>", "route kind: page, layout, or api")
    .option("--limit <number>", "maximum routes to return", "100"),
).action(async (value, options) => {
  if (options.kind && !["page", "layout", "api"].includes(options.kind)) {
    throw new Error("Route kind must be one of: page, layout, api.");
  }
  const limit = Number(options.limit);
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("Route limit must be a positive integer.");
  const routes = await repositoryRoutes(rootOf(value), {
    query: options.filter,
    area: options.area,
    kind: options.kind,
    limit,
  });
  print(routes, options.json, () => {
    if (!routes.length) {
      console.log("No verified routes matched.");
      return;
    }
    for (const route of routes) {
      console.log(`${route.kind.padEnd(6)} ${route.path}  ${route.file}`);
    }
  });
});
outputOptions(
  program
    .command("context")
    .description("Create agent-ready task context from the latest brain")
    .argument("<task>", "natural-language task")
    .argument("[path]", "repository path", ".")
    .option(
      "--ai",
      "use optional AI to rerank and interpret verified candidates",
    )
    .option(
      "--export [path]",
      "explicitly export the context Markdown snapshot",
    )
    .option("--include-preview", "include bounded source excerpts for implementation detail")
    .option("--budget <tokens>", "maximum estimated context tokens", "2000"),
).action(async (task, value, options) => {
  const root = rootOf(value);
  const budgetTokens = Number(options.budget);
  if (!Number.isInteger(budgetTokens) || budgetTokens <= 0) {
    throw new Error("Context budget must be a positive integer.");
  }
  const result = buildContextResult(await loadBrain(root), task, {
    includePreview: options.includePreview === true,
    budgetTokens,
  });
  if (result.status === "needs-clarification") {
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(
        "Your request is too broad to select reliable repository context.",
      );
      console.log(
        `\nMissing information: ${result.missingInformation.join(", ")}.`,
      );
      if (result.suggestions.length) {
        console.log("\nTry:");
        for (const suggestion of result.suggestions)
          console.log(`  compylar context \"${suggestion}\" .`);
      }
    }
    return;
  }
  const config = await loadConfig(root);
  const pack = options.ai
    ? await enrichContext(result, { ...config.ai, mode: "optional" })
    : result;
  const output = contextMarkdown(pack);
  if (options.export) {
    const slug =
      task
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "task";
    const target =
      typeof options.export === "string"
        ? path.resolve(root, options.export)
        : path.join(stateDir(root), `context-${slug}.md`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(
      target,
      `${output}\n<!-- Brain fingerprint: ${await loadBrain(root).then((brain) => brain.fingerprint)} -->\n`,
    );
    if (options.json)
      console.log(JSON.stringify({ ...pack, exportPath: target }, null, 2));
    else {
      console.log(output);
      console.log(chalk.dim(`\nExported ${target}`));
    }
    return;
  }
  if (options.json) console.log(JSON.stringify(pack, null, 2));
  else console.log(output);
});
outputOptions(
  program
    .command("status")
    .alias("diff")
    .description("Compare the working tree with the last successful compile")
    .argument("[path]", "repository path", "."),
)
  .option("--check", "exit with status 1 when knowledge is stale")
  .action(async (value, options) => {
    const root = rootOf(value);
    const result = await repositoryStatus(root);
    const brain = await loadBrain(root);
    print(result, options.json, () => {
      console.log(chalk.bold("Knowledge status"));
      console.log(`Baseline: ${result.baseline}`);
      console.log(`Scope: ${brain.packages.map((p) => p.name).join(", ")}`);
      console.log(
        `Added: ${result.added.join(", ") || "none"}\nChanged: ${result.changed.join(", ") || "none"}\nDeleted: ${result.deleted.join(", ") || "none"}`,
      );
      console.log(
        result.stale
          ? chalk.yellow(
              "Knowledge is stale; run compylar refresh . to update only what changed.",
            )
          : chalk.green("Knowledge is current."),
      );
    });
    if (options.check && result.stale) process.exitCode = 1;
  });
program
  .command("doctor")
  .description("Check repository and Compylar prerequisites")
  .argument("[path]", "repository path", ".")
  .action(async (value) => {
    const root = rootOf(value);
    const config = await loadConfig(root);
    const checks = [
      {
        name: "package.json",
        ok: await fs
          .access(path.join(root, "package.json"))
          .then(() => true)
          .catch(() => false),
      },
      {
        name: "git",
        ok: await fs
          .access(path.join(root, ".git"))
          .then(() => true)
          .catch(() => false),
      },
      {
        name: "compiled brain",
        ok: await fs
          .access(path.join(stateDir(root), "brain.json"))
          .then(() => true)
          .catch(() => false),
      },
      { name: "node:sqlite", ok: true },
    ];
    console.log(
      checks.map((check) => `${check.ok ? "✓" : "✗"} ${check.name}`).join("\n"),
    );
    console.log(
      `Limits: ${config.maxFiles} files, ${config.maxFileSize} bytes/file, ${config.maxTotalBytes} total bytes`,
    );
    console.log(
      `AI: ${config.ai.mode} mode · ${config.ai.provider}/${config.ai.model} · key ${process.env.OPENAI_API_KEY ? "available" : "not configured"}`,
    );
  });
program
  .command("help")
  .description("Show help for Compylar commands")
  .action(() => {
    console.log(program.helpInformation());
  });
program.parseAsync().catch((error) => {
  console.error(
    chalk.red(error instanceof Error ? error.message : String(error)),
  );
  console.error("Run `compylar --help` for usage.");
  process.exitCode = 1;
});
