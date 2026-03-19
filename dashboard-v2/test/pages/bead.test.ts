import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderBeadPage } from "../../src/pages/bead.js";

// Mock data modules
vi.mock("../../src/data/beads.js", () => ({
  getBead: vi.fn(),
  getBeadHistory: vi.fn(),
}));

vi.mock("../../src/data/convoys.js", () => ({
  listConvoys: vi.fn(),
  getConvoy: vi.fn(),
  getConvoyBeads: vi.fn(),
}));

vi.mock("../../src/data/agents.js", () => ({
  getAgentOutput: vi.fn(),
}));

vi.mock("../../src/data/git.js", () => ({
  getBeadBranchInfo: vi.fn(),
}));

import { getBead, getBeadHistory } from "../../src/data/beads.js";
import { listConvoys } from "../../src/data/convoys.js";
import { getAgentOutput } from "../../src/data/agents.js";

const mockedGetBead = vi.mocked(getBead);
const mockedGetBeadHistory = vi.mocked(getBeadHistory);
const mockedListConvoys = vi.mocked(listConvoys);
const mockedGetAgentOutput = vi.mocked(getAgentOutput);

const openBead = {
  id: "gt-abc12",
  title: "Add login page",
  description: "Build a login page\n\nDeliverables:\n- [ ] Login form\n- [x] Validation\n- [ ] Error handling",
  status: "open",
  priority: 2,
  issue_type: "task",
  created_at: "2026-03-10T10:00:00Z",
  updated_at: "2026-03-11T10:00:00Z",
  owner: "elifish",
  created_by: "mayor",
  dependencies: [],
  dependents: [],
};

const hookedBead = {
  ...openBead,
  id: "gt-def34",
  title: "Fix auth bug",
  status: "hooked",
  assignee: "gastown/polecats/furiosa",
  dependencies: [
    { id: "gt-abc12", title: "Add login page", status: "open", priority: 2 },
  ],
  dependents: [
    { id: "gt-ghi56", title: "Deploy auth", status: "open", priority: 1 },
  ],
};

const closedBead = {
  ...openBead,
  id: "gt-xyz99",
  title: "Setup CI",
  status: "closed",
  closed_at: "2026-03-12T10:00:00Z",
  close_reason: "Completed",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedListConvoys.mockResolvedValue([]);
  mockedGetBeadHistory.mockResolvedValue([]);
});

describe("bead detail page", () => {
  it("renders open bead with title, description, status", async () => {
    mockedGetBead.mockResolvedValue(openBead);
    const html = await renderBeadPage("gt-abc12");
    expect(html).toContain("Add login page");
    expect(html).toContain("open");
    expect(html).toContain("gt-abc12");
    expect(html).toContain("Build a login page");
  });

  it("renders acceptance criteria as checklist items", async () => {
    mockedGetBead.mockResolvedValue(openBead);
    const html = await renderBeadPage("gt-abc12");
    expect(html).toContain("Acceptance Criteria");
    expect(html).toContain("Login form");
    expect(html).toContain("Validation");
    expect(html).toContain("Error handling");
    // Checked item
    expect(html).toContain('checked');
    // Checkboxes are disabled (read-only)
    expect(html).toContain("disabled");
  });

  it("renders hooked bead with assignee and xterm.js agent output", async () => {
    mockedGetBead.mockResolvedValue(hookedBead);
    mockedGetAgentOutput.mockResolvedValue("$ gt prime\nYou are polecat furiosa...");
    const html = await renderBeadPage("gt-def34");
    expect(html).toContain("hooked");
    expect(html).toContain("gastown/polecats/furiosa");
    expect(html).toContain("Agent Output");
    expect(html).toContain("data-readonly-term");
    expect(html).toContain("/api/terminal/gastown-furiosa/raw");
  });

  it("renders closed bead with close info", async () => {
    mockedGetBead.mockResolvedValue(closedBead);
    const html = await renderBeadPage("gt-xyz99");
    expect(html).toContain("closed");
    expect(html).toContain("2026-03-12T10:00:00Z");
    expect(html).toContain("Completed");
  });

  it("renders dependencies and dependents", async () => {
    mockedGetBead.mockResolvedValue(hookedBead);
    const html = await renderBeadPage("gt-def34");
    expect(html).toContain("Depends On");
    expect(html).toContain("gt-abc12");
    expect(html).toContain("Add login page");
    expect(html).toContain("Blocks");
    expect(html).toContain("gt-ghi56");
    expect(html).toContain("Deploy auth");
  });

  it("renders breadcrumbs with rig and convoy links", async () => {
    mockedGetBead.mockResolvedValue(hookedBead);
    mockedListConvoys.mockResolvedValue([
      { id: "hq-cv-001", name: "Auth Work", status: "active", created_at: "2026-03-10", issues: ["gt-def34"] },
    ]);
    const html = await renderBeadPage("gt-def34");
    expect(html).toContain("breadcrumbs");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/rig/gastown"');
    expect(html).toContain('href="/convoy/hq-cv-001"');
  });

  it("renders timeline from history", async () => {
    mockedGetBead.mockResolvedValue(hookedBead);
    mockedGetBeadHistory.mockResolvedValue([
      { date: "2026-03-17T12:59:07Z", committer: "mayor", status: "hooked" },
      { date: "2026-03-13T20:33:25Z", committer: "mayor", status: "open" },
    ]);
    mockedGetAgentOutput.mockResolvedValue("");
    const html = await renderBeadPage("gt-def34");
    expect(html).toContain("Timeline");
    expect(html).toContain("timeline");
    expect(html).toContain("mayor");
  });

  it("returns not-found for missing bead", async () => {
    mockedGetBead.mockRejectedValue(new Error("not found"));
    const html = await renderBeadPage("gt-nope");
    expect(html).toContain("Bead Not Found");
    expect(html).toContain("gt-nope");
  });
});
