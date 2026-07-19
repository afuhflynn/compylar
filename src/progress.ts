import ora, { type Ora } from "ora";
import { ProgressEvent } from "./types.js";

export type ProgressReporter = (event: ProgressEvent) => void;
export type ProgressMode = "auto" | "interactive" | "plain" | "json" | "none";

const phaseLabels: Record<ProgressEvent["phase"], string> = {
  discover: "Discovering repository",
  enumerate: "Enumerating source files",
  hash: "Hashing files",
  parse: "Reusing cached analysis",
  extract: "Extracting knowledge",
  resolve: "Resolving relationships",
  persist: "Preparing repository brain",
  ai: "Enriching architecture",
};

const isInteractive = () =>
  Boolean(process.stderr.isTTY) && !process.env.CI && !process.env.NO_COLOR;

const relativeFile = (file?: string) => {
  if (!file) return "";
  const normalized = file.replaceAll("\\", "/");
  return normalized.length > 72 ? `…${normalized.slice(-71)}` : normalized;
};

const eventText = (event: ProgressEvent) => {
  const progress = event.total > 1 ? ` ${event.current}/${event.total}` : "";
  const file = relativeFile(event.file);
  const subject = file || event.packageName;
  return `${phaseLabels[event.phase]}${progress}${subject ? ` · ${subject}` : ""}`;
};

export type ProgressController = {
  reporter: ProgressReporter;
  complete(): void;
  fail(message: string): void;
  dispose(): void;
};

export function resolveProgressMode(mode: ProgressMode = "auto"): Exclude<ProgressMode, "auto"> {
  if (mode === "auto") return isInteractive() ? "interactive" : "plain";
  if (mode === "interactive" && !isInteractive()) return "plain";
  return mode;
}

export function createProgressController(mode: ProgressMode = "auto"): ProgressController {
  const resolved = resolveProgressMode(mode);
  let spinner: Ora | undefined;
  let lastPlainKey = "";
  let disposed = false;

  if (resolved === "interactive") {
    spinner = ora({
      text: "Starting compiler",
      stream: process.stderr,
      isEnabled: true,
      discardStdin: false,
    }).start();
  }

  const reporter: ProgressReporter = (event) => {
    if (disposed || resolved === "none") return;
    if (resolved === "interactive") {
      if (spinner) spinner.text = eventText(event);
      return;
    }
    if (resolved === "json") {
      process.stderr.write(`${JSON.stringify(event)}\n`);
      return;
    }
    const key = `${event.phase}:${event.packageName ?? ""}:${event.message}`;
    if (key === lastPlainKey) return;
    lastPlainKey = key;
    process.stderr.write(`· ${eventText(event)}\n`);
  };

  return {
    reporter,
    complete() {
      if (disposed) return;
      spinner?.stop();
      disposed = true;
    },
    fail(message) {
      if (disposed) return;
      if (spinner) spinner.fail(message);
      else if (resolved !== "none") process.stderr.write(`✖ ${message}\n`);
      disposed = true;
    },
    dispose() {
      if (disposed) return;
      spinner?.stopAndPersist({ symbol: "", text: "" });
      disposed = true;
    },
  };
}

export function terminalProgress(enabled = true): ProgressReporter {
  // The compiler API receives only a reporter, not lifecycle callbacks. Keep
  // its fallback renderer non-interactive so an API consumer cannot leave an
  // Ora spinner running after compilation returns.
  return createProgressController(enabled ? "plain" : "none").reporter;
}

export function silentProgress(): ProgressReporter {
  return () => undefined;
}
