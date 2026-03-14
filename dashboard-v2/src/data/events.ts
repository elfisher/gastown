import { exec } from "./exec.js";
import type { Event } from "./schemas.js";
import { getGtRoot } from "../config.js";

// Parse gt feed --plain output into structured events
function parseFeedLine(line: string): Event | null {
  // Format: [HH:MM:SS] <icon?> <source> <action/detail>
  const m = /^\[(\d{2}:\d{2}:\d{2})\]\s+(.+)$/.exec(line);
  if (!m) return null;
  const timestamp = m[1] ?? "";
  const rest = (m[2] ?? "").trim();

  // Try to split into source + detail
  // Common patterns: "→ source detail", "✓ source done: id", "🎯 source slung ..."
  const parts = rest.split(/\s{2,}/);
  const source = (parts[0] ?? rest).replace(/^[→✓🎯●]\s*/, "").trim();
  const detail = parts.slice(1).join(" ").trim();

  return { timestamp, source, action: detail || source, detail: detail || undefined };
}

export async function getEvents(since?: string): Promise<Event[]> {
  const root = getGtRoot();
  const args = ["feed", "--plain"];
  if (since) args.push("--since", since);
  const { stdout } = await exec("gt", args, { cwd: root, timeout: 10_000 });
  return stdout
    .split("\n")
    .map(parseFeedLine)
    .filter((e): e is Event => e !== null);
}

export async function getEventsForBead(beadId: string, since?: string): Promise<Event[]> {
  const events = await getEvents(since);
  return events.filter((e) => e.action.includes(beadId) || (e.detail?.includes(beadId) ?? false));
}

export async function getEventsForConvoy(convoyId: string, since?: string): Promise<Event[]> {
  const events = await getEvents(since);
  return events.filter((e) => e.action.includes(convoyId) || (e.detail?.includes(convoyId) ?? false));
}
