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

import { getMayorMessages, nudgeMayor } from "../../src/data/mayor.js";
import { exec } from "../../src/data/exec.js";

const mockExec = vi.mocked(exec);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMayorMessages", () => {
  it("parses tmux output into messages", async () => {
    mockExec.mockResolvedValueOnce({
      stdout: "All 4 polecats running.\n\nConvoy created with beads gt-abc12.\n",
      stderr: "",
    });
    const msgs = await getMayorMessages();
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0]!.sender).toBe("mayor");
  });

  it("returns system message when tmux fails", async () => {
    mockExec.mockRejectedValueOnce(new Error("no session"));
    const msgs = await getMayorMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.sender).toBe("system");
    expect(msgs[0]!.text).toContain("not available");
  });

  it("detects action messages", async () => {
    mockExec.mockResolvedValueOnce({
      stdout: "Slung gt-abc12 to furiosa\n",
      stderr: "",
    });
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
