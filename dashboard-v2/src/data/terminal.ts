/**
 * Log-based terminal streaming.
 *
 * Uses `tmux pipe-pane` to capture session output to log files, then reads
 * the tail of those files.  Falls back to `capture-pane` when the log file
 * doesn't exist yet (first request bootstraps pipe-pane).
 *
 * All output is stripped of ANSI escape codes and filtered for common noise
 * patterns (WARNING lines, HTML fragments, tool invocations).
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";
import { exec } from "./exec.js";

const LOG_DIR = join(config.townRoot, ".dashboard", "logs");

/** Sessions we've already started pipe-pane for. */
const pipedSessions = new Set<string>();

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-B]|\x0f/g;

/** Strip ANSI escape sequences from a string. */
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

/** Noise patterns filtered from terminal output. */
const NOISE_PATTERNS = [
  /^\s*$/,
  /^\s*[>%$#]\s*$/,
  // HTML/htmx fragments (from dashboard self-capture)
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
  // Common CLI noise
  /^WARNING: This binary was built with/,
  /^\s*Use 'make build' to create a properly signed binary/,
  /^\s*Run from:/,
  // Tool invocation noise from other sessions
  /^\s*\$ (curl|wget|tmux|gt feed|gt dashboard)\b/,
  /^HTTP\/[12]/,
  // tmux status line artifacts
  /^\[\d+\]\s*$/,
  // Bare control characters after ANSI stripping
  /^[\x00-\x1f\x7f]+$/,
];

function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line));
}

function logPath(session: string): string {
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

/** Clean a block of raw terminal text: strip ANSI, filter noise. */
function cleanLines(raw: string, maxLines: number): string[] {
  return raw
    .split("\n")
    .map(stripAnsi)
    .filter((l) => !isNoiseLine(l))
    .slice(-maxLines);
}

/** Read the last N lines from a session's log file, filtering noise. */
async function tailLog(
  session: string,
  lines: number,
): Promise<string[] | null> {
  const path = logPath(session);
  if (!existsSync(path)) return null;
  const stat = statSync(path);
  if (stat.size === 0) return null;

  try {
    // Read more raw lines than requested so we still have enough after filtering
    const result = await exec("tail", ["-n", String(lines * 3), path], {
      timeoutMs: 3_000,
    });
    return cleanLines(result.stdout, lines);
  } catch {
    return null;
  }
}

/** Fallback: capture-pane (first request before pipe-pane has written data). */
async function capturePane(session: string, lines: number): Promise<string[]> {
  try {
    const result = await exec(
      "tmux",
      ["capture-pane", "-t", session, "-p", "-S", `-${lines * 2}`],
      { timeoutMs: 5_000 },
    );
    return cleanLines(result.stdout, lines);
  } catch {
    return [];
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

  const fromLog = await tailLog(session, lines);
  if (fromLog !== null) return fromLog.join("\n");

  return (await capturePane(session, lines)).join("\n") || "(session not available)";
}

/**
 * Get terminal output as an array of cleaned lines, suitable for the mayor
 * chat view and other structured consumers.
 */
export async function getSessionLines(
  session: string,
  lines = 200,
): Promise<string[]> {
  await ensurePipe(session);

  const fromLog = await tailLog(session, lines);
  if (fromLog !== null) return fromLog.filter((l) => l.trim());

  return (await capturePane(session, lines)).filter((l) => l.trim());
}
