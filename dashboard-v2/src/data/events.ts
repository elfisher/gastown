import { exec } from "./exec.js";
import { cached } from "./cache.js";
import type { Event } from "./schemas.js";
import { getGtRoot } from "../config.js";

/** Event types that represent self-recovery noise — hidden unless recovery fails. */
const RECOVERY_NOISE_PATTERNS = [
  /session_death$/,
  /mass_death$/,
  /CRASHED_POLECAT:/,
];

/** Max recovery events for the same source within a window before surfacing as a failure. */
const RECOVERY_FAILURE_THRESHOLD = 3;
const RECOVERY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function parseFeedLine(line: string): Event | null {
  const m = /^\[(\d{2}:\d{2}:\d{2})\]\s+(.+)$/.exec(line);
  if (!m) return null;
  const timestamp = m[1] ?? "";
  const rest = (m[2] ?? "").trim();
  const parts = rest.split(/\s{2,}/);
  const source = (parts[0] ?? rest).replace(/^[→✓🎯●]\s*/, "").trim();
  const detail = parts.slice(1).join(" ").trim();
  return { timestamp, source, action: detail || source, detail: detail || undefined };
}

function isRecoveryNoise(event: Event): boolean {
  const text = event.action + (event.detail ? " " + event.detail : "");
  return RECOVERY_NOISE_PATTERNS.some((p) => p.test(text));
}

/**
 * Filters recovery noise from events. Individual session deaths and crash
 * detections are suppressed — they represent normal self-recovery. Only
 * surfaces a summary when the same source exceeds the failure threshold
 * within the recovery window (indicating recovery itself has failed).
 */
function filterRecoveryNoise(events: Event[]): Event[] {
  // Count recovery events per source within the window
  const recoveryCounts = new Map<string, number>();
  const now = new Date();

  for (const e of events) {
    if (!isRecoveryNoise(e)) continue;
    // Parse HH:MM:SS timestamp relative to today
    const [h, m, s] = e.timestamp.split(":").map(Number);
    const eventTime = new Date(now);
    eventTime.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
    if (now.getTime() - eventTime.getTime() <= RECOVERY_WINDOW_MS) {
      recoveryCounts.set(e.source, (recoveryCounts.get(e.source) ?? 0) + 1);
    }
  }

  // Sources that exceeded the threshold — recovery has failed
  const failedSources = new Set<string>();
  for (const [source, count] of recoveryCounts) {
    if (count >= RECOVERY_FAILURE_THRESHOLD) {
      failedSources.add(source);
    }
  }

  const result: Event[] = [];
  const surfacedFailures = new Set<string>();

  for (const e of events) {
    if (!isRecoveryNoise(e)) {
      result.push(e);
      continue;
    }
    // Only surface one summary event per failed source
    if (failedSources.has(e.source) && !surfacedFailures.has(e.source)) {
      surfacedFailures.add(e.source);
      const count = recoveryCounts.get(e.source) ?? 0;
      result.push({
        timestamp: e.timestamp,
        source: e.source,
        action: `Recovery failed (${count} attempts)`,
        detail: `Self-recovery exhausted — needs attention`,
      });
    }
    // Otherwise: silently suppressed (normal recovery)
  }

  return result;
}

export async function getEvents(since?: string): Promise<Event[]> {
  const cacheKey = `events:${since ?? "default"}`;
  return cached(cacheKey, 5_000, async () => {
    const root = getGtRoot();
    const args = ["feed", "--plain"];
    if (since) args.push("--since", since);
    try {
      const { stdout } = await exec("gt", args, { cwd: root, timeout: 10_000 });
      const raw = stdout
        .split("\n")
        .map(parseFeedLine)
        .filter((e): e is Event => e !== null);
      return filterRecoveryNoise(raw);
    } catch {
      return [];
    }
  });
}

export async function getEventsForRig(rigName: string, since?: string): Promise<Event[]> {
  const events = await getEvents(since);
  return events.filter((e) => e.source.includes(rigName) || (e.detail?.includes(rigName) ?? false));
}
