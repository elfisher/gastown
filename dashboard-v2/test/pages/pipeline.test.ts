import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Bead, PipelineData } from "../../src/data/pipeline.js";
import {
  renderPipelineContent,
  renderPipelinePage,
} from "../../src/pages/pipeline.js";

function makeBead(overrides: Partial<Bead> = {}): Bead {
  return {
    id: "gt-abc",
    title: "Test bead",
    status: "open",
    priority: 1,
    issue_type: "task",
    created_at: "2026-03-16T10:00:00Z",
    updated_at: "2026-03-16T12:00:00Z",
    ...overrides,
  };
}

function makeData(overrides: Partial<PipelineData> = {}): PipelineData {
  return {
    stages: [
      { name: "hooked", beads: [makeBead({ id: "gt-h1", status: "hooked", assignee: "gastown/polecats/furiosa" })] },
      { name: "open", beads: [makeBead({ id: "gt-o1", status: "open" })] },
      { name: "closed", beads: [makeBead({ id: "gt-c1", status: "closed" })] },
    ],
    rigs: ["gt"],
    total: 3,
    ...overrides,
  };
}

describe("pipeline page", () => {
  it("renders stage counts", () => {
    const html = renderPipelineContent(makeData());
    expect(html).toContain("Hooked");
    expect(html).toContain("Open");
    expect(html).toContain("Closed");
    // stat values
    expect(html).toContain(">1<");
  });

  it("renders bead cards with links", () => {
    const html = renderPipelineContent(makeData());
    expect(html).toContain("/bead/gt-h1");
    expect(html).toContain("/bead/gt-o1");
    expect(html).toContain("/bead/gt-c1");
    expect(html).toContain("Test bead");
  });

  it("renders assignee name", () => {
    const html = renderPipelineContent(makeData());
    expect(html).toContain("furiosa");
  });

  it("renders unassigned for beads without assignee", () => {
    const html = renderPipelineContent(makeData());
    expect(html).toContain("unassigned");
  });

  it("renders empty state", () => {
    const data = makeData({
      stages: [
        { name: "hooked", beads: [] },
        { name: "open", beads: [] },
        { name: "closed", beads: [] },
      ],
      total: 0,
    });
    const html = renderPipelineContent(data);
    expect(html).toContain("No work items");
  });

  it("full page includes filter bar", () => {
    const html = renderPipelinePage(makeData());
    expect(html).toContain("Pipeline");
    expect(html).toContain("All rigs");
    expect(html).toContain("Any priority");
    expect(html).toContain("/api/pipeline");
  });

  it("full page includes htmx polling", () => {
    const html = renderPipelinePage(makeData());
    expect(html).toContain('hx-get="/api/pipeline"');
    expect(html).toContain("hx-trigger");
  });

  it("renders priority badges", () => {
    const html = renderPipelineContent(makeData());
    expect(html).toContain("P1");
  });

  it("bead cards have no input/textarea/button/form", () => {
    const html = renderPipelineContent(makeData());
    // Collapse checkboxes are DaisyUI structural, not user inputs
    // Verify no text inputs, textareas, buttons, or forms
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toMatch(/<input(?![^>]*type="checkbox")/);
  });

  it("api fragment has no <html> tag", () => {
    const html = renderPipelineContent(makeData());
    expect(html).not.toContain("<html");
  });
});
