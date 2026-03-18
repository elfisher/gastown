import { describe, it, expect } from "vitest";
import { linkify } from "../../src/pages/linkify.js";

describe("linkify", () => {
  it("converts a bead ID to a link", () => {
    expect(linkify("Slung gt-9e5 to furiosa")).toContain(
      '<a href="/bead/gt-9e5" class="link link-hover font-mono">gt-9e5</a>'
    );
  });

  it("converts a convoy ID to a link", () => {
    expect(linkify("Convoy hq-cv-abc12 started")).toContain(
      '<a href="/convoy/hq-cv-abc12" class="link link-hover font-mono">hq-cv-abc12</a>'
    );
  });

  it("handles multiple bead IDs in one string", () => {
    const result = linkify("Depends on gt-abc12 and gt-def34");
    expect(result).toContain('href="/bead/gt-abc12"');
    expect(result).toContain('href="/bead/gt-def34"');
  });

  it("handles mixed convoy and bead IDs", () => {
    const result = linkify("Convoy hq-cv-x7k2m has gt-m3k9p");
    expect(result).toContain('href="/convoy/hq-cv-x7k2m"');
    expect(result).toContain('href="/bead/gt-m3k9p"');
  });

  it("handles hq-prefixed bead IDs (not convoys)", () => {
    const result = linkify("See hq-abc12 for details");
    expect(result).toContain('href="/bead/hq-abc12"');
  });

  it("does not linkify CSS-like tokens", () => {
    const result = linkify("badge-sm text-xs font-mono");
    expect(result).not.toContain("<a ");
  });

  it("returns plain text unchanged when no IDs present", () => {
    const input = "No entity IDs here at all";
    expect(linkify(input)).toBe(input);
  });

  it("handles bead IDs with various prefixes", () => {
    const result = linkify("le-abc gt-xyz bd-12a hq-99z");
    expect(result).toContain('href="/bead/le-abc"');
    expect(result).toContain('href="/bead/gt-xyz"');
    expect(result).toContain('href="/bead/bd-12a"');
    expect(result).toContain('href="/bead/hq-99z"');
  });

  it("does not double-linkify convoy IDs as bead IDs", () => {
    const result = linkify("hq-cv-abc12");
    const linkCount = (result.match(/<a /g) || []).length;
    expect(linkCount).toBe(1);
    expect(result).toContain('href="/convoy/hq-cv-abc12"');
  });

  it("preserves surrounding text", () => {
    const result = linkify("Issue gt-swk is assigned");
    expect(result).toBe(
      'Issue <a href="/bead/gt-swk" class="link link-hover font-mono">gt-swk</a> is assigned'
    );
  });

  it("handles wisp IDs", () => {
    const result = linkify("molecule gt-wisp-fji5 attached");
    expect(result).toContain('href="/bead/gt-wisp-fji5"');
  });

  it("handles IDs at start and end of string", () => {
    const result = linkify("gt-abc");
    expect(result).toContain('href="/bead/gt-abc"');
  });

  it("encodes special characters in IDs for href", () => {
    // Normal IDs don't have special chars, but encodeURIComponent is applied
    const result = linkify("gt-abc12");
    expect(result).toContain('href="/bead/gt-abc12"');
  });
});
