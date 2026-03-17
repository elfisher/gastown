import { config } from "../config.js";
import { exec } from "./exec.js";
import type { MayorMessage } from "./schemas.js";

const ACTION_PATTERNS = [
  /\bslung?\b/i,
  /\bbead\s+created\b/i,
  /\bconvoy\s+creat/i,
  /\bspawn/i,
  /\bmerge/i,
  /\bnudge\b/i,
];

/** Lines to filter from tmux capture (noise / recursive dashboard content). */
const NOISE_PATTERNS = [
  /^\s*$/,
  /^\s*[>%$#]\s*$/,
  /hx-get=|hx-post=|hx-trigger=|hx-swap=/i,
  /class="chat |class="alert /,
  /chat-bubble|chat-start|chat-end/,
  /whitespace-pre-wrap/,
  /^\s*<\/?div/,
  /^\s*<\/?form/,
  /^\s*<\/?pre/,
  /^\s*<input /,
  /^\s*<button /,
  /^\s*<span /,
  /^\s*<time /,
];

/** Server-side store for human-sent messages. */
const sentMessages: MayorMessage[] = [];

export function addSentMessage(text: string): void {
  sentMessages.push({
    sender: "human",
    text,
    timestamp: new Date().toISOString(),
  });
}

function isActionMessage(text: string): boolean {
  return ACTION_PATTERNS.some((p) => p.test(text));
}

function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line));
}

function parseTimestamp(line: string): string | null {
  const m = line.match(
    /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)?)/
  );
  return m?.[1] ?? null;
}

export async function getMayorMessages(): Promise<MayorMessage[]> {
  const messages: MayorMessage[] = [];

  try {
    const result = await exec(
      "tmux",
      ["capture-pane", "-t", "hq-mayor", "-p", "-S", "-200"],
      { timeoutMs: 5_000 }
    );
    const lines = result.stdout
      .split("\n")
      .filter((l) => l.trim() && !isNoiseLine(l));

    let block: string[] = [];
    for (const line of lines) {
      if (line.match(/^\s*[>%$#]\s*$/)) {
        if (block.length > 0) {
          const text = block.join("\n");
          messages.push({
            sender: "mayor",
            text,
            timestamp: parseTimestamp(text) ?? new Date().toISOString(),
            isAction: isActionMessage(text),
          });
          block = [];
        }
      } else {
        block.push(line);
      }
    }
    if (block.length > 0) {
      const text = block.join("\n");
      messages.push({
        sender: "mayor",
        text,
        timestamp: parseTimestamp(text) ?? new Date().toISOString(),
        isAction: isActionMessage(text),
      });
    }
  } catch {
    messages.push({
      sender: "system",
      text: "Mayor session not available. Start with: gt mayor attach",
      timestamp: new Date().toISOString(),
    });
  }

  // Merge sent messages into the timeline by timestamp
  const all = [...messages, ...sentMessages];
  all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return all;
}

export async function nudgeMayor(message: string): Promise<void> {
  await exec("gt", ["nudge", "mayor", message], {
    cwd: config.townRoot,
    timeoutMs: 15_000,
  });
}
