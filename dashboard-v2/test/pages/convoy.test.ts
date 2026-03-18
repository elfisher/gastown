import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderConvoyPage } from "../../src/pages/convoy.js";

vi.mock("../../src/data/convoys.js", () => ({
  getConvoy: vi.fn(),
}));

vi.mock("../../src/data/beads.js", () => ({
  listBeads: vi.fn(),
  getBead: vi.fn(),
}));

import { getConvoy } from "../../src/data/convoys.js";
import { listBeads, getBead } from "../../src/data/beads.js";

const mockedGetConvoy = vi.mocked(getConvoy);
const mockedListBeads = vi.mocked(listBeads);
const mockedGetBead = vi.mocked(getBead);

const convoy = {
  id: "hq-cv-001",
  name: "Auth Work",
  status: "active",
  created_at: "2026-03-10",
  issues: ["gt-aaa", "gt-bbb", "gt-ccc"],
};

function makeBead(id: string, title: string, status = "open") {
  return {
    id,
    title,
    status,
    priority: 2,
    issue_type: "task" as const,
    created_at: "2026-03-10T10:00:00Z",
    updated_at: "2026-03-11T10:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("convoy page", () => {
  it("renders convoy header and bead table", async () => {
    mockedGetConvoy.mockResolvedValue(convoy);
    mockedListBeads.mockResolvedValue([makeBead("gt-aaa", "Task A")]);
    mockedGetBead.mockResolvedValue({ ...makeBead("gt-aaa", "Task A"), dependencies: [], dependents: [] });

    const html = await renderConvoyPage("hq-cv-001");
    expect(html).toContain("Auth Work");
    expect(html).toContain("gt-aaa");
    expect(html).toContain("Task A");
  });

  it("populates edges from bead dependencies", async () => {
    mockedGetConvoy.mockResolvedValue(convoy);
    mockedListBeads.mockResolvedValue([
      makeBead("gt-aaa", "Task A"),
      makeBead("gt-bbb", "Task B"),
      makeBead("gt-ccc", "Task C"),
    ]);
    // gt-bbb depends on gt-aaa, gt-ccc depends on gt-bbb
    mockedGetBead.mockImplementation(async (id: string) => {
      if (id === "gt-aaa") return { ...makeBead("gt-aaa", "Task A"), dependencies: [], dependents: [] };
      if (id === "gt-bbb") return { ...makeBead("gt-bbb", "Task B"), dependencies: [{ id: "gt-aaa", title: "Task A", status: "open", priority: 2 }], dependents: [] };
      if (id === "gt-ccc") return { ...makeBead("gt-ccc", "Task C"), dependencies: [{ id: "gt-bbb", title: "Task B", status: "open", priority: 2 }], dependents: [] };
      throw new Error("not found");
    });

    const html = await renderConvoyPage("hq-cv-001");
    // Parse the serialized dagData from the script tag
    const match = html.match(/window\.__dagData\s*=\s*({.*?});/);
    expect(match).toBeTruthy();
    const dagData = JSON.parse(match![1]);

    expect(dagData.nodes).toHaveLength(3);
    expect(dagData.edges).toHaveLength(2);
    // gt-aaa -> gt-bbb (aaa blocks bbb)
    expect(dagData.edges).toContainEqual({ source: "gt-aaa", target: "gt-bbb" });
    // gt-bbb -> gt-ccc (bbb blocks ccc)
    expect(dagData.edges).toContainEqual({ source: "gt-bbb", target: "gt-ccc" });
  });

  it("excludes edges to beads outside the convoy", async () => {
    mockedGetConvoy.mockResolvedValue({ ...convoy, issues: ["gt-aaa", "gt-bbb"] });
    mockedListBeads.mockResolvedValue([
      makeBead("gt-aaa", "Task A"),
      makeBead("gt-bbb", "Task B"),
    ]);
    // gt-bbb depends on gt-aaa (in convoy) and gt-zzz (not in convoy)
    mockedGetBead.mockImplementation(async (id: string) => {
      if (id === "gt-aaa") return { ...makeBead("gt-aaa", "Task A"), dependencies: [], dependents: [] };
      if (id === "gt-bbb") return {
        ...makeBead("gt-bbb", "Task B"),
        dependencies: [
          { id: "gt-aaa", title: "Task A", status: "open", priority: 2 },
          { id: "gt-zzz", title: "External", status: "open", priority: 2 },
        ],
        dependents: [],
      };
      throw new Error("not found");
    });

    const html = await renderConvoyPage("hq-cv-001");
    const match = html.match(/window\.__dagData\s*=\s*({.*?});/);
    const dagData = JSON.parse(match![1]);

    expect(dagData.edges).toHaveLength(1);
    expect(dagData.edges[0]).toEqual({ source: "gt-aaa", target: "gt-bbb" });
  });

  it("handles getBead failures gracefully", async () => {
    mockedGetConvoy.mockResolvedValue(convoy);
    mockedListBeads.mockResolvedValue([
      makeBead("gt-aaa", "Task A"),
      makeBead("gt-bbb", "Task B"),
    ]);
    // gt-aaa fails, gt-bbb succeeds with a dep on gt-aaa
    mockedGetBead.mockImplementation(async (id: string) => {
      if (id === "gt-aaa") throw new Error("timeout");
      if (id === "gt-bbb") return {
        ...makeBead("gt-bbb", "Task B"),
        dependencies: [{ id: "gt-aaa", title: "Task A", status: "open", priority: 2 }],
        dependents: [],
      };
      throw new Error("not found");
    });

    const html = await renderConvoyPage("hq-cv-001");
    const match = html.match(/window\.__dagData\s*=\s*({.*?});/);
    const dagData = JSON.parse(match![1]);

    // Edge still created from gt-bbb's dep data even though gt-aaa's getBead failed
    expect(dagData.edges).toHaveLength(1);
    expect(dagData.edges[0]).toEqual({ source: "gt-aaa", target: "gt-bbb" });
  });

  it("returns not-found for missing convoy", async () => {
    mockedGetConvoy.mockRejectedValue(new Error("not found"));
    const html = await renderConvoyPage("hq-nope");
    expect(html).toContain("Convoy Not Found");
  });

  it("renders empty edges when no dependencies exist", async () => {
    mockedGetConvoy.mockResolvedValue(convoy);
    mockedListBeads.mockResolvedValue([makeBead("gt-aaa", "Task A")]);
    mockedGetBead.mockResolvedValue({ ...makeBead("gt-aaa", "Task A"), dependencies: [], dependents: [] });

    const html = await renderConvoyPage("hq-cv-001");
    const match = html.match(/window\.__dagData\s*=\s*({.*?});/);
    const dagData = JSON.parse(match![1]);

    expect(dagData.edges).toHaveLength(0);
  });
});
