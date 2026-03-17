import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock exec before importing mayor module
vi.mock("../../src/data/exec.js", () => ({
  exec: vi.fn(),
  ExecError: class ExecError extends Error {
    constructor(
      public readonly command: string,
      public readonly stderr: string,
      public readonly exitCode: number | null
    ) {
      super(`Command failed: ${command}`);
      this.name = "ExecError";
    }
  },
}));

vi.mock("../../src/config.js", () => ({
  config: { townRoot: "/tmp/gt", port: 8081, host: "0.0.0.0" },
}));

vi.mock("../../src/data/terminal.js", () => ({
  getSessionOutput: vi.fn().mockResolvedValue("(session not available)"),
  getSessionLines: vi.fn().mockResolvedValue([]),
}));

import { getMayorMessages, nudgeMayor } from "../../src/data/mayor.js";
import { exec } from "../../src/data/exec.js";
import { getSessionLines } from "../../src/data/terminal.js";

const mockExec = vi.mocked(exec);
const mockGetSessionLines = vi.mocked(getSessionLines);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMayorMessages", () => {
  it("parses tmux output into messages", async () => {
    mockGetSessionLines.mockResolvedValueOnce([
      "All 4 polecats running.",
      "Convoy created with beads gt-abc12.",
    ]);
    const msgs = await getMayorMessages();
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0]!.sender).toBe("mayor");
  });

  it("returns system message when tmux fails", async () => {
    mockGetSessionLines.mockRejectedValueOnce(new Error("no session"));
    const msgs = await getMayorMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.sender).toBe("system");
    expect(msgs[0]!.text).toContain("not available");
  });

  it("detects action messages", async () => {
    mockGetSessionLines.mockResolvedValueOnce([
      "Slung gt-abc12 to furiosa",
    ]);
    const msgs = await getMayorMessages();
    expect(msgs.some((m) => m.isAction)).toBe(true);
  });
});

describe("nudgeMayor", () => {
  it("calls gt nudge mayor with message", async () => {
    mockExec.mockResolvedValueOnce({ stdout: "", stderr: "" });
    await nudgeMayor("hello mayor");
    expect(mockExec).toHaveBeenCalledWith(
      "gt",
      ["nudge", "mayor", "hello mayor"],
      expect.objectContaining({ cwd: "/tmp/gt" })
    );
  });
});
