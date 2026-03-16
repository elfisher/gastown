import { describe, it, expect } from "vitest";
import { RigSchema, RigListSchema } from "../../src/data/schemas.js";

describe("RigSchema", () => {
  it("validates a valid rig", () => {
    const rig = {
      name: "gastown",
      beads_prefix: "gt",
      status: "operational",
      witness: "running",
      refinery: "running",
      polecats: 2,
      crew: 1,
    };
    expect(RigSchema.parse(rig)).toEqual(rig);
  });

  it("rejects missing required field", () => {
    expect(() => RigSchema.parse({ name: "test" })).toThrow();
  });

  it("rejects wrong type", () => {
    expect(() =>
      RigSchema.parse({
        name: "test",
        beads_prefix: "t",
        status: "ok",
        witness: "running",
        refinery: "running",
        polecats: "two",
        crew: 0,
      })
    ).toThrow();
  });
});

describe("RigListSchema", () => {
  it("validates an array of rigs", () => {
    const rigs = [
      {
        name: "gastown",
        beads_prefix: "gt",
        status: "operational",
        witness: "running",
        refinery: "running",
        polecats: 1,
        crew: 0,
      },
    ];
    expect(RigListSchema.parse(rigs)).toEqual(rigs);
  });

  it("validates empty array", () => {
    expect(RigListSchema.parse([])).toEqual([]);
  });
});
