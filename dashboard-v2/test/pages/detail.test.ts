import { describe, it, expect } from "vitest";
import { buildApp } from "../../src/server.js";

describe("rig detail page", () => {
  it("GET /rig/gastown returns 200 with rig content", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/rig/gastown" });
    expect(res.statusCode).toBe(200);
    const body = res.body;
    expect(body).toContain("Rig:");
    expect(body).toContain("Convoys");
    expect(body).toContain("Agents");
    expect(body).toContain("Activity");
    await app.close();
  });

  it("GET /rig/nonexistent returns 200 with not-found message", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/rig/nonexistent" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Rig Not Found");
    await app.close();
  });
});

describe("convoy detail page", () => {
  it("GET /convoy/nonexistent returns 200 with not-found message", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/convoy/nonexistent" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Convoy Not Found");
    await app.close();
  });
});
