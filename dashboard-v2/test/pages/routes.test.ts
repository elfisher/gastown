import { describe, it, expect } from "vitest";
import { buildApp } from "../../src/server.js";

describe("routes", () => {
  const routes = [
    "/",
    "/pipeline",
    "/agents",
    "/mayor",
    "/tour",
    "/rig/gastown",
    "/convoy/test-123",
    "/bead/gt-abc12",
    "/agent/furiosa",
  ];

  for (const path of routes) {
    it(`GET ${path} returns 200`, async () => {
      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: path });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      await app.close();
    });
  }

  it("layout contains left nav", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/" });
    const body = res.body;
    expect(body).toContain("Gas Town");
    expect(body).toContain("drawer");
    expect(body).toContain("Pipeline");
    expect(body).toContain("Agents");
    expect(body).toContain("Mayor");
    await app.close();
  });
});
