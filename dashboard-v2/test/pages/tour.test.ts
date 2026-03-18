import { describe, it, expect } from "vitest";
import { renderTourPage } from "../../src/pages/tour.js";

describe("renderTourPage", () => {
  const html = renderTourPage();

  it("renders all 6 tour steps", () => {
    expect(html).toContain("Step 1:");
    expect(html).toContain("Step 6:");
  });

  it("includes start tour button", () => {
    expect(html).toContain("__startTour()");
    expect(html).toContain("Start Tour");
  });

  it("includes key concept names", () => {
    expect(html).toContain("Pipeline");
    expect(html).toContain("Rigs");
    expect(html).toContain("Mayor");
    expect(html).toContain("Agents");
    expect(html).toContain("Convoys");
    expect(html).toContain("Merge Queue");
  });
});
