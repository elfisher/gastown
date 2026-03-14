import { describe, it, expect, afterAll } from "vitest";
import { buildApp } from "./server.js";
import { RigListSchema } from "./data/schemas.js";

describe("dashboard-v2", () => {
  const appPromise = buildApp();

  afterAll(async () => {
    const app = await appPromise;
    await app.close();
  });

  const routes = [
    "/",
    "/pipeline",
    "/agents",
    "/mayor",
    "/tour",
    "/rig/gastown",
    "/convoy/test-id",
    "/bead/test-id",
    "/agent/test-name",
  ];

  for (const route of routes) {
    it(`GET ${route} returns 200`, async () => {
      const app = await appPromise;
      const res = await app.inject({ method: "GET", url: route });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
    });
  }

  it("overview page contains left nav with rig names", async () => {
    const app = await appPromise;
    const res = await app.inject({ method: "GET", url: "/" });
    const body = res.body;
    // Should contain the nav structure
    expect(body).toContain("Gas Town");
    expect(body).toContain("/rig/");
  });

  it("RigListSchema validates sample data", () => {
    const sample = [
      { name: "test", beads_prefix: "t", status: "operational", witness: "running", refinery: "running", polecats: 1, crew: 0 },
    ];
    expect(() => RigListSchema.parse(sample)).not.toThrow();
  });

  it("RigListSchema rejects invalid data", () => {
    expect(() => RigListSchema.parse([{ name: 123 }])).toThrow();
  });
});
