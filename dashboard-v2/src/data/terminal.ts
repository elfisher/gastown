/**
 * Log-based terminal streaming.
 *
 * Uses `tmux pipe-pane` to capture session output to log files, then reads
 * the tail of those files.  Falls back to `capture-pane` when the log file
 * doesn't exist yet (first request bootstraps pipe-pane).
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";
import { exec } from "./exec.js";

const LOG_DIR = join(config.townRoot, ".dashboard", "logs");

/** Sessions we've already started pipe-pane for. */
const pipedSessions = new Set<string>();

/** Noise patterns filtered from terminal output. */
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
  // CLI noise: commands that leak from other processes or recursive captures
  /^\s*\$\s+(curl|gt\s+nudge|gt\s+mail|tmux|docker)\b/,
  /^\s*curl\s+(-[sS]|--silent|http)/,
  /^\s*gt\s+nudge\s+mayor\b/,
  // ANSI escape sequences
  /\x1b\[[0-9;]*[a-zA-Z]/,
  // tmux status/control lines
  /^\s*%begin\b|^\s*%end\b|^\s*%output\b/,
  // HTTP response fragments from curl
  /^\s*\{?"ok"\s*:\s*(true|false)/,
  /^\s*HTTP\/[12]/,
];

/** Strip ANSI escape sequences from a line. */
function stripAnsi(line: string): string {
  return line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line));
}

function logPath(session: string): string {
  // Sanitise session name for filesystem safety
  const safe = session.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(LOG_DIR, `${safe}.log`);
}

/** Ensure log dir exists and start pipe-pane for a session (idempotent). */
async function ensurePipe(session: string): Promise<void> {
  if (pipedSessions.has(session)) return;
  try {
    await exec("mkdir", ["-p", LOG_DIR], { timeoutMs: 3_000 });
    const path = logPath(session);
    // pipe-pane -o appends; using cat >> to avoid overwriting on restart
    await exec(
      "tmux",
      ["pipe-pane", "-t", session, "-o", `cat >> ${path}`],
      { timeoutMs: 5_000 },
    );
    pipedSessions.add(session);
  } catch {
    // tmux session may not exist — that's fine, we'll fall back
  }
}

/** Read the last N lines from a session's log file, filtering noise. */
async function tailLog(
  session: string,
  lines: number,
): Promise<string | null> {
  const path = logPath(session);
  if (!existsSync(path)) return null;
  // Only read if file has content
  const stat = statSync(path);
  if (stat.size === 0) return null;

  try {
    // Read more raw lines than requested so we still have enough after filtering
    const result = await exec("tail", ["-n", String(lines * 3), path], {
      timeoutMs: 3_000,
    });
    const filtered = result.stdout
      .split("\n")
      .map(stripAnsi)
      .filter((l) => !isNoiseLine(l));
    return filtered.slice(-lines).join("\n");
  } catch {
    return null;
  }
}

/**
 * Get terminal output for a tmux session.
 *
 * Prefers log file (via pipe-pane), falls back to capture-pane.
 */
export async function getSessionOutput(
  session: string,
  lines = 20,
): Promise<string> {
  await ensurePipe(session);

  // Try log-based read first
  const fromLog = await tailLog(session, lines);
  if (fromLog !== null) return fromLog;

  // Fallback: capture-pane (first request before pipe-pane has written data)
  try {
    const result = await exec(
      "tmux",
      ["capture-pane", "-t", session, "-p", "-S", `-${lines}`],
      { timeoutMs: 5_000 },
    );
    return result.stdout.trimEnd();
  } catch {
    return "(session not available)";
  }
}

/**
 * Get terminal output for a session, with noise filtering and line grouping
 * suitable for the mayor chat view.
 */
export async function getSessionLines(
  session: string,
  lines = 200,
): Promise<string[]> {
  await ensurePipe(session);

  const fromLog = await tailLog(session, lines);
  if (fromLog !== null) {
    return fromLog.split("\n").filter((l) => l.trim());
  }

  // Fallback
  try {
    const result = await exec(
      "tmux",
      ["capture-pane", "-t", session, "-p", "-S", `-${lines}`],
      { timeoutMs: 5_000 },
    );
    return result.stdout
      .split("\n")
      .map(stripAnsi)
      .filter((l) => l.trim() && !isNoiseLine(l));
  } catch {
    return [];
  }
}
