import { describe, it, expect } from "vitest";
import {
  BeadSchema,
  BeadListSchema,
  BeadDetailSchema,
  ConvoySchema,
  ConvoyListSchema,
  AgentSchema,
  AgentListSchema,
  EventSchema,
} from "../../src/data/schemas.js";

describe("BeadSchema", () => {
  const validBead = {
    id: "gt-abc12",
    title: "Fix auth bug",
    status: "open",
    priority: 1,
    issue_type: "bug",
    created_at: "2026-03-13",
    updated_at: "2026-03-14",
  };

  it("validates a valid bead", () => {
    expect(BeadSchema.parse(validBead)).toEqual(validBead);
  });

  it("validates bead with optional fields", () => {
    const full = { ...validBead, assignee: "slit", description: "details", labels: ["urgent"] };
    expect(BeadSchema.parse(full).assignee).toBe("slit");
  });

  it("rejects missing required field", () => {
    expect(() => BeadSchema.parse({ id: "gt-x" })).toThrow();
  });
});

describe("BeadDetailSchema", () => {
  it("validates bead with dependencies", () => {
    const detail = {
      id: "gt-abc12",
      title: "Fix auth",
      status: "open",
      priority: 1,
      issue_type: "bug",
      created_at: "2026-03-13",
      updated_at: "2026-03-14",
      dependencies: [{ id: "gt-dep1", title: "Setup", status: "closed", priority: 2 }],
      dependents: [],
    };
    const parsed = BeadDetailSchema.parse(detail);
    expect(parsed.dependencies).toHaveLength(1);
  });
});

describe("ConvoySchema", () => {
  const validConvoy = {
    id: "hq-cv-abc",
    name: "Auth System",
    status: "active",
    created_at: "2026-03-13",
    issues: ["gt-abc12", "gt-def34"],
    issue_count: 2,
  };

  it("validates a valid convoy", () => {
    expect(ConvoySchema.parse(validConvoy)).toEqual(validConvoy);
  });

  it("rejects missing name", () => {
    expect(() => ConvoySchema.parse({ id: "x", status: "active", created_at: "2026" })).toThrow();
  });
});

describe("AgentSchema", () => {
  it("validates agent", () => {
    const agent = {
      name: "slit",
      rig: "gastown",
      role: "polecat" as const,
      session: "gastown-slit",
      status: "working" as const,
      startedAt: "2026-03-13T00:00:00Z",
      lastActivity: "2026-03-13T01:00:00Z",
    };
    expect(AgentSchema.parse(agent)).toEqual(agent);
  });
});

describe("EventSchema", () => {
  it("validates event", () => {
    const event = { timestamp: "15:30:00", source: "slit", action: "completed gt-abc12" };
    expect(EventSchema.parse(event)).toEqual(event);
  });
});
