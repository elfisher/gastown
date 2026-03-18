import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderMayorPage, renderMessages } from "../../src/pages/mayor.js";
import type { MayorMessage } from "../../src/data/schemas.js";

describe("renderMayorPage", () => {
  it("renders chat UI with messages container", () => {
    const html = renderMayorPage([]);
    expect(html).toContain("mayor-messages");
    expect(html).toContain("/api/mayor/messages");
    expect(html).toContain("/api/mayor/nudge");
    expect(html).toContain('type="text"');
    expect(html).toContain("Send");
  });

  it("contains input box (only input in dashboard)", () => {
    const html = renderMayorPage([]);
    expect(html).toContain('name="message"');
    expect(html).toContain("input");
    expect(html).toContain("btn btn-primary");
  });
});

describe("renderMessages", () => {
  it("renders empty state", () => {
    const html = renderMessages([]);
    expect(html).toContain("No messages yet");
  });

  it("renders mayor messages with chat-start", () => {
    const msgs: MayorMessage[] = [
      { sender: "mayor", text: "Hello from mayor", timestamp: "2026-03-16T12:00:00Z" },
    ];
    const html = renderMessages(msgs);
    expect(html).toContain("chat-start");
    expect(html).toContain("Hello from mayor");
    expect(html).toContain("mayor");
  });

  it("renders human messages with chat-end", () => {
    const msgs: MayorMessage[] = [
      { sender: "human", text: "Build auth", timestamp: "2026-03-16T12:01:00Z" },
    ];
    const html = renderMessages(msgs);
    expect(html).toContain("chat-end");
    expect(html).toContain("chat-bubble-primary");
    expect(html).toContain("Build auth");
  });

  it("renders action messages as alert cards", () => {
    const msgs: MayorMessage[] = [
      {
        sender: "mayor",
        text: "Slung gt-abc12 to furiosa",
        timestamp: "2026-03-16T12:02:00Z",
        isAction: true,
      },
    ];
    const html = renderMessages(msgs);
    expect(html).toContain("alert");
    expect(html).toContain("alert-info");
    expect(html).toContain("Slung");
    expect(html).toContain('href="/bead/gt-abc12"');
    expect(html).toContain("furiosa");
    // Action messages should NOT use chat bubbles
    expect(html).not.toContain("chat-start");
  });

  it("renders system messages with warning style", () => {
    const msgs: MayorMessage[] = [
      { sender: "system", text: "Mayor session not available", timestamp: "2026-03-16T12:00:00Z" },
    ];
    const html = renderMessages(msgs);
    expect(html).toContain("chat-bubble-warning");
  });

  it("renders messages in chronological order with timestamps", () => {
    const msgs: MayorMessage[] = [
      { sender: "mayor", text: "First", timestamp: "2026-03-16T12:00:00Z" },
      { sender: "human", text: "Second", timestamp: "2026-03-16T12:01:00Z" },
      { sender: "mayor", text: "Third", timestamp: "2026-03-16T12:02:00Z" },
    ];
    const html = renderMessages(msgs);
    const firstIdx = html.indexOf("First");
    const secondIdx = html.indexOf("Second");
    const thirdIdx = html.indexOf("Third");
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
    expect(html).toContain("12:00:00Z");
    expect(html).toContain("12:01:00Z");
  });

  it("escapes HTML in message text", () => {
    const msgs: MayorMessage[] = [
      { sender: "mayor", text: "<script>alert('xss')</script>", timestamp: "2026-03-16T12:00:00Z" },
    ];
    const html = renderMessages(msgs);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
