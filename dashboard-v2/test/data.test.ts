import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RigSchema, RigListSchema,
  BeadSchema, BeadListSchema, BeadDetailSchema,
  ConvoySchema, ConvoyListSchema,
  AgentSchema, AgentListSchema,
  EventSchema,
  TmuxSessionSchema,
  GitDiffSchema, GitLogSchema,
} from "../src/data/schemas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
function fixture(name: string): string {
  return readFileSync(resolve(__dirname, "fixtures", name), "utf-8");
}

// --- Schema Tests ---

describe("RigSchema", () => {
  it("parses valid rig", () => {
    const rig = RigSchema.parse({
      name: "gastown", beads_prefix: "gt", status: "operational",
      witness: "running", refinery: "running", polecats: 2, crew: 0,
    });
    expect(rig.name).toBe("gastown");
  });

  it("rejects missing required field", () => {
    expect(() => RigSchema.parse({ name: "x" })).toThrow();
  });

  it("rejects wrong type", () => {
    expect(() => RigSchema.parse({
      name: "x", beads_prefix: "x", status: "x",
      witness: "x", refinery: "x", polecats: "not-a-number", crew: 0,
    })).toThrow();
  });

  it("parses fixture list", () => {
    const rigs = RigListSchema.parse(JSON.parse(fixture("rigs.json")));
    expect(rigs.length).toBe(2);
    expect(rigs[0]?.name).toBe("gastown");
  });
});

describe("BeadSchema", () => {
  it("parses valid bead", () => {
    const bead = BeadSchema.parse({
      id: "gt-52r", title: "Test", status: "open", priority: 1,
      issue_type: "task", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    });
    expect(bead.id).toBe("gt-52r");
  });

  it("rejects missing id", () => {
    expect(() => BeadSchema.parse({ title: "x", status: "open", priority: 1, issue_type: "task", created_at: "x", updated_at: "x" })).toThrow();
  });

  it("rejects wrong priority type", () => {
    expect(() => BeadSchema.parse({
      id: "x", title: "x", status: "open", priority: "high",
      issue_type: "task", created_at: "x", updated_at: "x",
    })).toThrow();
  });

  it("parses fixture list", () => {
    const beads = BeadListSchema.parse(JSON.parse(fixture("beads.json")));
    expect(beads.length).toBe(2);
    expect(beads[0]?.status).toBe("in_progress");
  });
});

describe("BeadDetailSchema", () => {
  it("parses bead with deps", () => {
    const arr = JSON.parse(fixture("bead-detail.json"));
    const bead = BeadDetailSchema.parse(arr[0]);
    expect(bead.dependencies?.length).toBe(1);
    expect(bead.dependents?.length).toBe(1);
  });

  it("parses bead without deps", () => {
    const bead = BeadDetailSchema.parse({
      id: "x", title: "x", status: "open", priority: 1,
      issue_type: "task", created_at: "x", updated_at: "x",
    });
    expect(bead.dependencies).toBeUndefined();
  });

  it("rejects invalid dep shape", () => {
    expect(() => BeadDetailSchema.parse({
      id: "x", title: "x", status: "open", priority: 1,
      issue_type: "task", created_at: "x", updated_at: "x",
      dependencies: [{ bad: true }],
    })).toThrow();
  });
});

describe("ConvoySchema", () => {
  it("parses valid convoy", () => {
    const c = ConvoySchema.parse({
      id: "hq-cv-abc", name: "Test", status: "open",
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(c.id).toBe("hq-cv-abc");
  });

  it("rejects missing name", () => {
    expect(() => ConvoySchema.parse({ id: "x", status: "open", created_at: "x" })).toThrow();
  });

  it("rejects wrong status type", () => {
    expect(() => ConvoySchema.parse({ id: "x", name: "x", status: 123, created_at: "x" })).toThrow();
  });

  it("parses fixture list", () => {
    const convoys = ConvoyListSchema.parse(JSON.parse(fixture("convoys.json")));
    expect(convoys.length).toBe(1);
    expect(convoys[0]?.issues?.length).toBe(3);
  });
});

describe("AgentSchema", () => {
  it("parses valid agent", () => {
    const a = AgentSchema.parse({ name: "furiosa", role: "polecat" });
    expect(a.name).toBe("furiosa");
  });

  it("rejects missing role", () => {
    expect(() => AgentSchema.parse({ name: "x" })).toThrow();
  });

  it("rejects wrong name type", () => {
    expect(() => AgentSchema.parse({ name: 123, role: "polecat" })).toThrow();
  });
});

describe("EventSchema", () => {
  it("parses valid event", () => {
    const e = EventSchema.parse({ timestamp: "23:48:05", source: "nux", action: "done: gt-lop" });
    expect(e.source).toBe("nux");
  });

  it("rejects missing timestamp", () => {
    expect(() => EventSchema.parse({ source: "x", action: "x" })).toThrow();
  });

  it("rejects wrong action type", () => {
    expect(() => EventSchema.parse({ timestamp: "x", source: "x", action: 123 })).toThrow();
  });
});

describe("TmuxSessionSchema", () => {
  it("parses valid session", () => {
    const s = TmuxSessionSchema.parse({ name: "gt-furiosa", attached: false });
    expect(s.name).toBe("gt-furiosa");
  });

  it("rejects missing name", () => {
    expect(() => TmuxSessionSchema.parse({ attached: true })).toThrow();
  });

  it("rejects wrong attached type", () => {
    expect(() => TmuxSessionSchema.parse({ name: "x", attached: "yes" })).toThrow();
  });
});

describe("GitDiffSchema / GitLogSchema", () => {
  it("parses valid git entry", () => {
    const g = GitDiffSchema.parse({ hash: "abc", author: "A", date: "2026-01-01", message: "init" });
    expect(g.hash).toBe("abc");
  });

  it("rejects missing hash", () => {
    expect(() => GitDiffSchema.parse({ author: "A", date: "x", message: "x" })).toThrow();
  });

  it("rejects wrong message type", () => {
    expect(() => GitDiffSchema.parse({ hash: "x", author: "x", date: "x", message: 123 })).toThrow();
  });
});

// --- Exec Tests (use real exec, not mocked) ---

describe("exec", () => {
  it("handles command not found", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await expect(execFileAsync("nonexistent-cmd-xyz-99", [])).rejects.toThrow();
  });

  it("handles non-zero exit", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await expect(execFileAsync("false", [])).rejects.toThrow();
  });

  it("captures stderr on failure", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    try {
      await execFileAsync("sh", ["-c", "echo err >&2; exit 1"]);
    } catch (e: unknown) {
      expect((e as { stderr: string }).stderr).toContain("err");
    }
  });
});

// --- Data Fetcher Tests (mocked exec) ---

vi.mock("../src/data/exec.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/data/exec.js")>();
  return { ...orig, exec: vi.fn() };
});

vi.mock("../src/config.js", () => ({
  getGtRoot: () => "/tmp/fake-gt",
}));

describe("data fetchers with mocked exec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listRigs parses fixture", async () => {
    const { exec } = await import("../src/data/exec.js");
    vi.mocked(exec).mockResolvedValue({ stdout: fixture("rigs.json"), stderr: "" });
    const { listRigs } = await import("../src/data/rigs.js");
    const rigs = await listRigs();
    expect(rigs.length).toBe(2);
  });

  it("listBeads parses fixture", async () => {
    const { exec } = await import("../src/data/exec.js");
    vi.mocked(exec).mockResolvedValue({ stdout: fixture("beads.json"), stderr: "" });
    const { listBeads } = await import("../src/data/beads.js");
    const beads = await listBeads();
    expect(beads.length).toBe(2);
  });

  it("getBead parses detail fixture", async () => {
    const { exec } = await import("../src/data/exec.js");
    vi.mocked(exec).mockResolvedValue({ stdout: fixture("bead-detail.json"), stderr: "" });
    const { getBead } = await import("../src/data/beads.js");
    const bead = await getBead("gt-52r");
    expect(bead.dependencies?.length).toBe(1);
  });

  it("listConvoys parses fixture", async () => {
    const { exec } = await import("../src/data/exec.js");
    vi.mocked(exec).mockResolvedValue({ stdout: fixture("convoys.json"), stderr: "" });
    const { listConvoys } = await import("../src/data/convoys.js");
    const convoys = await listConvoys();
    expect(convoys.length).toBe(1);
  });

  it("getGitLog parses fixture", async () => {
    const { exec } = await import("../src/data/exec.js");
    vi.mocked(exec).mockResolvedValue({ stdout: fixture("gitlog.txt"), stderr: "" });
    const { getGitLog } = await import("../src/data/git.js");
    const log = await getGitLog("/tmp");
    expect(log.length).toBe(2);
    expect(log[0]?.message).toBe("feat: add dashboard v2 foundation");
  });
});
