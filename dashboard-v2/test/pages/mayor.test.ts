import { describe, it, expect } from "vitest";
import { renderMayorPage } from "../../src/pages/mayor.js";

describe("renderMayorPage", () => {
  it("renders xterm.js terminal container", () => {
    const html = renderMayorPage();
    expect(html).toContain('id="terminal"');
    expect(html).toContain("/static/terminal.js");
    expect(html).toContain("/ws/terminal/hq-mayor");
  });

  it("includes xterm.css stylesheet", () => {
    const html = renderMayorPage();
    expect(html).toContain("xterm.css");
  });

  it("does not contain old chat UI elements", () => {
    const html = renderMayorPage();
    expect(html).not.toContain("mayor-messages");
    expect(html).not.toContain("chat-bubble");
    expect(html).not.toContain("/api/mayor/messages");
  });
});
