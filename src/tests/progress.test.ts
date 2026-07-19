import { describe, expect, it, vi } from "vitest";
import { createProgressController, resolveProgressMode } from "../progress.js";

describe("compile progress renderer", () => {
  it("falls back from interactive mode when stderr is not a TTY", () => {
    expect(resolveProgressMode("interactive")).toBe("plain");
  });

  it("can emit structured events without terminal decoration", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const controller = createProgressController("json");
    controller.reporter({
      phase: "extract",
      current: 2,
      total: 4,
      message: "analyzed",
      file: "src/app.ts",
    });
    controller.dispose();
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"phase":"extract"'),
    );
    expect(write.mock.calls.join(" ")).not.toContain("\\u001b");
    write.mockRestore();
  });
});
