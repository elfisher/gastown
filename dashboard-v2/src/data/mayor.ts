import { config } from "../config.js";
import { exec } from "./exec.js";
import { getSessionLines } from "./terminal.js";
import type { MayorMessage } from "./schemas.js";

const ACTION_PATTERNS = [
  /\bslung?\b/i,
  /\bbead\s+created\b/i,
  /\bconvoy\s+creat/i,
  /\bspawn/i,
  /\bmerge/i,
  /\bnudge\b/i,
];

/** Lines that are noise from recursive tmux capture or CLI leakage. */
const MAYOR_NOISE = [
  /^\s*$/,
  // Recursive dashboard HTML fragments
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
  // CLI noise
  /^\s*\$\s+(curl|gt\s+nudge|tmux|docker)\b/,
  /^\s*curl\s+(-[sS]|--silent|http)/,
  // ANSI escapes
  /\x1b\[[0-9;]*[a-zA-Z]/,
  // tmux control
  /^\s*%begin\b|^\s*%end\b|^\s*%output\b/,
  // HTTP fragments
  /^\s*\{?"ok"\s*:\s*(true|false)/,
  /^\s*HTTP\/[12]/,
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

function isMayorNoise(line: string): boolean {
  return MAYOR_NOISE.some((p) => p.test(line));
}

function isActionMessage(text: string): boolean {
  return ACTION_PATTERNS.some((p) => p.test(text));
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
    const lines = await getSessionLines("hq-mayor", 200);

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
      } else if (!isMayorNoise(line)) {
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
