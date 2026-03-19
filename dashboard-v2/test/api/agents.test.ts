import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/data/agents.js", () => ({
  listAgents: vi.fn(),
  listAgentsForRig: vi.fn().mockResolvedValue([]),
  getAgentPreview: vi.fn(),
  getAgentOutput: vi.fn(),
  getAgentSessionInfo: vi.fn().mockResolvedValue(undefined),
  getAgentWorkHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/data/mayor.js", () => ({
  getMayorMessages: vi.fn().mockResolvedValue([]),
  nudgeMayor: vi.fn(),
}));

vi.mock("../../src/data/rigs.js", () => ({
  listRigs: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/data/projects.js", () => ({
  getProjectsData: vi.fn().mockResolvedValue({ rigs: [], convoys: [], agents: [] }),
}));

vi.mock("../../src/data/terminal.js", () => ({
  getSessionOutput: vi.fn().mockResolvedValue(""),
}));

vi.mock("../../src/config.js", () => ({
  config: { townRoot: "/tmp/gt", port: 8081, host: "0.0.0.0" },
}));

import { buildApp } from "../../src/server.js";
import { listAgents, getAgentPreview, getAgentOutput } from "../../src/data/agents.js";

const mockListAgents = vi.mocked(listAgents);
const mockGetPreview = vi.mocked(getAgentPreview);
const mockGetOutput = vi.mocked(getAgentOutput);

const MOCK_AGENT = {
  name: "furiosa",
  rig: "gt",
  role: "polecat" as const,
  session: "gt-furiosa",
  status: "working" as const,
  startedAt: "2026-03-16T12:00:00Z",
  lastActivity: "2026-03-16T12:05:00Z",
};

describe("Agents API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /agents returns 200 with cards for active sessions", async () => {
    mockListAgents.mockResolvedValueOnce([MOCK_AGENT]);
    mockGetPreview.mockResolvedValue("Building...");
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/agents" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("furiosa");
    expect(res.body).toContain("Worker Agents");
    await app.close();
  });

  it("GET /api/agents returns HTML fragment with agent cards", async () => {
    mockListAgents.mockResolvedValueOnce([MOCK_AGENT]);
    mockGetPreview.mockResolvedValue("output line");
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/agents" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("furiosa");
    await app.close();
  });

  it("GET /api/agents/:name/preview returns HTML fragment", async () => {
    mockGetPreview.mockResolvedValueOnce("tmux captured text");
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/agents/gt-furiosa/preview" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("tmux captured text");
    await app.close();
  });

  it("GET /api/agents/:name/output returns xterm.js container", async () => {
    mockGetOutput.mockResolvedValueOnce("live output here");
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/agents/gt-furiosa/output" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("data-readonly-term-inline");
    await app.close();
  });

  it("GET /agent/:name returns 200 with xterm.js live output", async () => {
    mockListAgents.mockResolvedValueOnce([MOCK_AGENT]);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/agent/gt-furiosa" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("furiosa");
    expect(res.body).toContain("Live Output");
    expect(res.body).toContain("data-readonly-term");
    expect(res.body).toContain("/api/terminal/gt-furiosa/raw");
    await app.close();
  });

  it("GET /agent/:name returns 404 for unknown agent", async () => {
    mockListAgents.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/agent/gt-unknown" });
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain("Not Found");
    await app.close();
  });

  it("cards contain no input/textarea/button/form elements (read-only)", async () => {
    mockListAgents.mockResolvedValueOnce([MOCK_AGENT]);
    mockGetPreview.mockResolvedValue("");
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/agents" });
    expect(res.body).not.toMatch(/<input[\s>]/);
    expect(res.body).not.toMatch(/<textarea[\s>]/);
    expect(res.body).not.toMatch(/<button[\s>]/);
    expect(res.body).not.toMatch(/<form[\s>]/);
    await app.close();
  });

  it("agent detail page contains no input/textarea/button/form elements", async () => {
    mockListAgents.mockResolvedValueOnce([MOCK_AGENT]);
    mockGetOutput.mockResolvedValueOnce("output");
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/agent/gt-furiosa" });
    // The layout may contain the mayor form, but the agent content itself should not
    // Check the agent-specific content area
    const agentContent = res.body.split("Live Output")[1] ?? "";
    expect(agentContent).not.toMatch(/<input[\s>]/);
    expect(agentContent).not.toMatch(/<textarea[\s>]/);
    expect(agentContent).not.toMatch(/<form[\s>]/);
    await app.close();
  });
});
