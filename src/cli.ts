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
import { repositoryRefresh, repositoryStatus } from "./services.js";
import { runMcpServer } from "./mcp.js";
import { COMPYLAR_VERSION } from "./version.js";
import { loadConfig } from "./config.js";
import { checkMcpHealth } from "./mcp-health.js";
import {
  applyAgentInstall,
  createAgentInstallPlan,
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
program
  .command("mcp")
  .description("Run the read-only Compylar MCP server over stdio")
  .argument("[path]", "repository scope", ".")
  .action(async (value) => {
    await runMcpServer(rootOf(value));
  });
outputOptions(
  program
    .command("mcp-health")
    .description("Verify Compylar's MCP protocol contract")
    .argument("[path]", "repository scope", "."),
).action(async (value, options) => {
  const result = await checkMcpHealth(rootOf(value));
  print(result, options.json, () => {
    console.log(
      result.status === "healthy"
        ? chalk.green("MCP server is healthy.")
        : chalk.red("MCP protocol health check failed."),
    );
    if (result.server)
      console.log(`Server: ${result.server.name}@${result.server.version}`);
    if (result.tools) console.log(`Tools (${result.tools.length}): ${result.tools.join(", ")}`);
    console.log(`Handshake: ${result.elapsedMs.toFixed(1)}ms`);
    if (result.error) console.log(`Error: ${result.error}`);
    console.log(`Next: ${result.action}`);
  });
  if (result.status !== "healthy") process.exitCode = 1;
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
  const result = options.apply ? await applyAgentInstall(plan) : plan;
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
    if (result.state === "ready")
      console.log("Run again with --apply to copy this skill.");
    if (result.state === "conflict")
      console.log("Remove or rename the existing skill yourself before applying.");
    console.log(`\n${result.mcp.guidance}`);
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
    ),
).action(async (task, value, options) => {
  const root = rootOf(value);
  const result = buildContextResult(await loadBrain(root), task);
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
