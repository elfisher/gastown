import { describe, it, expect } from "vitest";
import {
  renderAgentsPage,
  renderAgentCards,
  renderAgentDetailPage,
  renderAgentOutput,
} from "../../src/pages/agents.js";
import type { Agent } from "../../src/data/schemas.js";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    name: "furiosa",
    rig: "gt",
    role: "polecat",
    session: "gt-furiosa",
    status: "working",
    startedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    ...overrides,
  };
}

describe("renderAgentsPage", () => {
  it("renders page with agent count badge", () => {
    const html = renderAgentsPage([makeAgent()]);
    expect(html).toContain("Agents");
    expect(html).toContain("1 active");
    expect(html).toContain("/api/agents");
  });

  it("renders empty state", () => {
    const html = renderAgentsPage([]);
    expect(html).toContain("0 active");
  });
});

describe("renderAgentCards", () => {
  it("groups system and worker agents", () => {
    const agents = [
      makeAgent({ name: "mayor", role: "mayor", session: "hq-mayor" }),
      makeAgent({ name: "witness", role: "witness", session: "gt-witness" }),
      makeAgent({ name: "furiosa", role: "polecat", session: "gt-furiosa" }),
    ];
    const html = renderAgentCards(agents);
    expect(html).toContain("System Agents");
    expect(html).toContain("Worker Agents");
    expect(html).toContain("mayor");
    expect(html).toContain("furiosa");
  });

  it("renders status badges correctly", () => {
    const working = makeAgent({ status: "working" });
    const idle = makeAgent({ status: "idle", name: "idle-agent" });
    const dead = makeAgent({ status: "dead", name: "dead-agent" });
    const html = renderAgentCards([working, idle, dead]);
    expect(html).toContain("badge-primary");
    expect(html).toContain("badge-ghost");
    expect(html).toContain("badge-error");
  });

  it("renders agent name as link to detail page", () => {
    const html = renderAgentCards([makeAgent()]);
    expect(html).toContain('href="/agent/gt-furiosa"');
  });

  it("renders preview terminal container when present", () => {
    const agent = makeAgent({ preview: "Building feature X..." });
    const html = renderAgentCards([agent]);
    expect(html).toContain("data-readonly-term");
    expect(html).toContain("/api/terminal/gt-furiosa/raw");
  });

  it("renders current work badge when present", () => {
    const agent = makeAgent({ currentWork: "gt-abc12" });
    const html = renderAgentCards([agent]);
    expect(html).toContain("gt-abc12");
  });

  it("escapes HTML in agent data", () => {
    const agent = makeAgent({ name: "<script>xss</script>" });
    const html = renderAgentCards([agent]);
    expect(html).not.toContain("<script>xss</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("contains no input/textarea/button/form elements", () => {
    const html = renderAgentCards([makeAgent()]);
    expect(html).not.toMatch(/<input[\s>]/);
    expect(html).not.toMatch(/<textarea[\s>]/);
    expect(html).not.toMatch(/<button[\s>]/);
    expect(html).not.toMatch(/<form[\s>]/);
  });
});

describe("renderAgentDetailPage", () => {
  it("renders agent detail with live output section", () => {
    const agent = makeAgent();
    const html = renderAgentDetailPage(agent);
    expect(html).toContain("furiosa");
    expect(html).toContain("Live Output");
    expect(html).toContain("data-readonly-term");
    expect(html).toContain("/api/terminal/gt-furiosa/raw");
  });

  it("renders session info and stats", () => {
    const agent = makeAgent();
    const html = renderAgentDetailPage(agent);
    expect(html).toContain("gt-furiosa");
    expect(html).toContain("Started");
    expect(html).toContain("Last Activity");
    expect(html).toContain("Runtime");
  });

  it("contains no input/textarea/button/form elements", () => {
    const html = renderAgentDetailPage(makeAgent());
    expect(html).not.toMatch(/<input[\s>]/);
    expect(html).not.toMatch(/<textarea[\s>]/);
    expect(html).not.toMatch(/<button[\s>]/);
    expect(html).not.toMatch(/<form[\s>]/);
  });
});

describe("renderAgentOutput", () => {
  it("renders xterm.js container", () => {
    const html = renderAgentOutput("hello world");
    expect(html).toContain("data-readonly-term-inline");
  });

  it("does not include raw output text (xterm.js fetches it client-side)", () => {
    const html = renderAgentOutput("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("&lt;script&gt;");
  });
});
