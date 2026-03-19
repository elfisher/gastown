import { describe, it, expect } from "vitest";
import { escapeHtml, statusBadge, statusColor, priorityLabel } from "../../src/pages/helpers.js";

describe("escapeHtml", () => {
  it("escapes special characters", () => {
    expect(escapeHtml('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
  });
});

describe("statusColor", () => {
  it("returns success for closed", () => {
    expect(statusColor("closed")).toBe("badge-success");
  });
  it("returns info for in_progress", () => {
    expect(statusColor("in_progress")).toBe("badge-info");
  });
  it("returns error for blocked", () => {
    expect(statusColor("blocked")).toBe("badge-error");
  });
  it("returns ghost for unknown", () => {
    expect(statusColor("whatever")).toBe("badge-ghost");
  });
});

describe("statusBadge", () => {
  it("renders badge HTML", () => {
    const html = statusBadge("open");
    expect(html).toContain("badge");
    expect(html).toContain("open");
  });
});

describe("priorityLabel", () => {
  it("renders P0 as error", () => {
    expect(priorityLabel(0)).toContain("badge-error");
    expect(priorityLabel(0)).toContain("P0");
  });
  it("renders P2 as info", () => {
    expect(priorityLabel(2)).toContain("badge-info");
  });
});
