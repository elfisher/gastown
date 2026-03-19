import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/data/mayor.js", () => ({
  getMayorMessages: vi.fn(),
  nudgeMayor: vi.fn(),
  addSentMessage: vi.fn(),
}));

vi.mock("../../src/data/rigs.js", () => ({
  listRigs: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/config.js", () => ({
  config: { townRoot: "/tmp/gt", port: 8081, host: "0.0.0.0" },
}));

import { buildApp } from "../../src/server.js";
import { nudgeMayor } from "../../src/data/mayor.js";

const mockNudge = vi.mocked(nudgeMayor);

describe("Mayor API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /mayor returns 200 with xterm terminal", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/mayor" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain('id="terminal"');
    expect(res.body).toContain("/ws/terminal/hq-mayor");
    await app.close();
  });

  it("POST /api/mayor/nudge executes nudge and returns 200", async () => {
    mockNudge.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/mayor/nudge",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "message=test+nudge",
    });
    expect(res.statusCode).toBe(200);
    expect(mockNudge).toHaveBeenCalledWith("test nudge");
    await app.close();
  });

  it("POST /api/mayor/nudge with JSON body returns 200", async () => {
    mockNudge.mockResolvedValueOnce(undefined);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/mayor/nudge",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ message: "json test" }),
    });
    expect(res.statusCode).toBe(200);
    expect(mockNudge).toHaveBeenCalledWith("json test");
    await app.close();
  });

  it("POST /api/mayor/nudge with empty message returns 400", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/mayor/nudge",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ message: "" }),
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
