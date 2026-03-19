import { describe, it, expect, vi, beforeEach } from "vitest";
import { MayorMessageSchema, MayorMessageListSchema } from "../../src/data/schemas.js";

describe("MayorMessageSchema", () => {
  it("validates a mayor message", () => {
    const msg = {
      sender: "mayor",
      text: "Convoy created with 3 beads",
      timestamp: "2026-03-16T12:00:00Z",
    };
    expect(MayorMessageSchema.parse(msg)).toEqual(msg);
  });

  it("validates a human message", () => {
    const msg = {
      sender: "human",
      text: "Build the auth system",
      timestamp: "2026-03-16T12:00:00Z",
    };
    expect(MayorMessageSchema.parse(msg)).toEqual(msg);
  });

  it("validates an action message", () => {
    const msg = {
      sender: "mayor",
      text: "Slung gt-abc12 to furiosa",
      timestamp: "2026-03-16T12:00:00Z",
      isAction: true,
    };
    expect(MayorMessageSchema.parse(msg)).toEqual(msg);
  });

  it("rejects invalid sender", () => {
    expect(() =>
      MayorMessageSchema.parse({
        sender: "unknown",
        text: "hello",
        timestamp: "2026-03-16T12:00:00Z",
      })
    ).toThrow();
  });

  it("rejects missing text", () => {
    expect(() =>
      MayorMessageSchema.parse({
        sender: "mayor",
        timestamp: "2026-03-16T12:00:00Z",
      })
    ).toThrow();
  });

  it("validates a list of messages", () => {
    const msgs = [
      { sender: "mayor" as const, text: "Hello", timestamp: "2026-03-16T12:00:00Z" },
      { sender: "human" as const, text: "Hi", timestamp: "2026-03-16T12:01:00Z" },
    ];
    expect(MayorMessageListSchema.parse(msgs)).toEqual(msgs);
  });
});
