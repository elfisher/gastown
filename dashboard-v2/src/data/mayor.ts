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

  // Capture mayor tmux pane output
  try {
    const result = await exec(
      "tmux",
      ["capture-pane", "-t", "hq-mayor", "-p", "-S", "-200"],
      { timeoutMs: 5_000 }
    );
    const lines = result.stdout.split("\n").filter((l) => l.trim());
    // Group non-empty lines into message blocks separated by blank lines or prompt markers
    let block: string[] = [];
    for (const line of lines) {
      if (line.match(/^\s*[>%$#]\s*$/) || line.match(/^\s*$/)) {
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
    // Mayor session may not be running
    messages.push({
      sender: "system",
      text: "Mayor session not available. Start with: gt mayor attach",
      timestamp: new Date().toISOString(),
    });
  }

  return messages;
}

export async function nudgeMayor(message: string): Promise<void> {
  await exec("gt", ["nudge", "mayor", message], {
    cwd: config.townRoot,
    timeoutMs: 15_000,
  });
}
