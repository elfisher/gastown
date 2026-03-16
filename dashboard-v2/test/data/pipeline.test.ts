import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock exec before importing pipeline module
vi.mock("../../src/data/exec.js", () => ({
  exec: vi.fn(),
  ExecError: class extends Error {
    constructor(
      public command: string,
      public stderr: string,
      public exitCode: number | null
    ) {
      super(`Command failed: ${command}`);
    }
  },
}));

vi.mock("../../src/config.js", () => ({
  config: { townRoot: "/tmp/test-town", port: 8081, host: "0.0.0.0" },
}));

import { exec } from "../../src/data/exec.js";
import { listBeads, getPipelineData } from "../../src/data/pipeline.js";

const mockExec = vi.mocked(exec);

const FIXTURE_BEADS = [
  {
    id: "gt-abc",
    title: "Fix bug",
    status: "open",
    priority: 1,
    issue_type: "task",
    created_at: "2026-03-16T10:00:00Z",
    updated_at: "2026-03-16T12:00:00Z",
    dependency_count: 0,
    dependent_count: 0,
  },
  {
    id: "gt-def",
    title: "Hooked work",
    status: "hooked",
    priority: 2,
    issue_type: "task",
    assignee: "gastown/polecats/furiosa",
    created_at: "2026-03-16T10:00:00Z",
    updated_at: "2026-03-16T12:00:00Z",
    dependency_count: 0,
    dependent_count: 0,
  },
  {
    id: "gt-ghi",
    title: "Done task",
    status: "closed",
    priority: 1,
    issue_type: "task",
    created_at: "2026-03-15T10:00:00Z",
    updated_at: "2026-03-16T08:00:00Z",
    dependency_count: 0,
    dependent_count: 0,
  },
  {
    id: "gt-wisp-xyz",
    title: "Internal wisp",
    status: "open",
    priority: 2,
    issue_type: "epic",
    created_at: "2026-03-16T10:00:00Z",
    updated_at: "2026-03-16T12:00:00Z",
    dependency_count: 0,
    dependent_count: 0,
  },
  {
    id: "gt-agent-foo",
    title: "Agent bead",
    status: "open",
    priority: 0,
    issue_type: "task",
    labels: ["gt:agent"],
    created_at: "2026-03-16T10:00:00Z",
    updated_at: "2026-03-16T12:00:00Z",
    dependency_count: 0,
    dependent_count: 0,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockExec.mockResolvedValue({
    stdout: JSON.stringify(FIXTURE_BEADS),
    stderr: "",
  });
});

describe("pipeline data", () => {
  it("listBeads filters out agent beads and wisps", async () => {
    const beads = await listBeads();
    expect(beads).toHaveLength(3);
    expect(beads.map((b) => b.id)).toEqual(["gt-abc", "gt-def", "gt-ghi"]);
  });

  it("getPipelineData groups by stage", async () => {
    const data = await getPipelineData();
    expect(data.stages).toHaveLength(3);
    expect(data.stages[0]!.name).toBe("hooked");
    expect(data.stages[0]!.beads).toHaveLength(1);
    expect(data.stages[1]!.name).toBe("open");
    expect(data.stages[1]!.beads).toHaveLength(1);
    expect(data.stages[2]!.name).toBe("closed");
    expect(data.stages[2]!.beads).toHaveLength(1);
    expect(data.total).toBe(3);
  });

  it("getPipelineData returns rig list", async () => {
    const data = await getPipelineData();
    expect(data.rigs).toContain("gt");
  });

  it("filters by priority", async () => {
    const data = await getPipelineData({ priority: 1 });
    // priority <= 1 means gt-abc (P1) and gt-ghi (P1), not gt-def (P2)
    expect(data.total).toBe(2);
  });
});
