import { config } from "../config.js";
import { exec } from "./exec.js";
import { getSessionOutput } from "./terminal.js";
import type { Agent } from "./schemas.js";

const SYSTEM_ROLES = new Map<string, Agent["role"]>([
  ["mayor", "mayor"],
  ["deacon", "deacon"],
  ["witness", "witness"],
  ["refinery", "refinery"],
  ["boot", "boot"],
]);

/** Seconds of inactivity before an agent is considered idle. */
const IDLE_THRESHOLD_SEC = 600;

/**
 * If a session died within this window, treat it as "recovering" rather than
 * "dead" — the witness/deacon will respawn it automatically.
 */
const RECOVERY_GRACE_SEC = 120;

function parseSession(name: string): { rig: string; role: Agent["role"]; agentName: string } | null {
  const dash = name.indexOf("-");
  if (dash < 0) return null;
  const prefix = name.slice(0, dash);
  const suffix = name.slice(dash + 1);
  const role = SYSTEM_ROLES.get(suffix) ?? "polecat";
  return { rig: prefix, role, agentName: suffix };
}

/** Build a map from beads_prefix (e.g. "gt") to rig name (e.g. "gastown"). */
async function loadPrefixToRigMap(): Promise<Map<string, string>> {
  try {
    const { stdout } = await exec("gt", ["rig", "list", "--json"], {
      cwd: config.townRoot,
      timeoutMs: 5_000,
    });
    const jsonStart = stdout.indexOf("[");
    if (jsonStart < 0) return new Map();
    const rigs = JSON.parse(stdout.slice(jsonStart)) as Array<{ name: string; beads_prefix: string }>;
    return new Map(rigs.map((r) => [r.beads_prefix, r.name]));
  } catch {
    return new Map();
  }
}

/** Derive the gt hook status target path for an agent. */
function hookTarget(rigName: string, role: Agent["role"], agentName: string): string {
  if (role === "mayor" || role === "deacon" || role === "boot") return `${role}`;
  if (role === "polecat") return `${rigName}/polecats/${agentName}`;
  return `${rigName}/${role}`;
}

/** Query hooked work for an agent. Returns "id: title" or undefined. */
async function getHookedWork(target: string): Promise<string | undefined> {
  try {
    const { stdout } = await exec(
      "gt",
      ["hook", "status", target, "--json"],
      { cwd: config.townRoot, timeoutMs: 5_000 }
    );
    const jsonStart = stdout.indexOf("{");
    if (jsonStart < 0) return undefined;
    const info = JSON.parse(stdout.slice(jsonStart));
    if (!info.has_work) return undefined;
    const bead = info.pinned_bead;
    if (bead?.id && bead?.title) return `${bead.id}: ${bead.title}`;
    if (info.progress?.root_id) return `${info.progress.root_id}: ${info.progress.root_title ?? ""}`.trim();
    return undefined;
  } catch {
    return undefined;
  }
}


/**
 * Get recently dead sessions from the feed to detect agents in recovery.
 * Returns a set of session name prefixes that died within the grace window.
 */
async function getRecentDeaths(): Promise<Set<string>> {
  const deaths = new Set<string>();
  try {
    const result = await exec(
      "gt",
      ["feed", "--plain", "--since", `${RECOVERY_GRACE_SEC}s`],
      { timeoutMs: 5_000 }
    );
    for (const line of result.stdout.split("\n")) {
      if (/session_death/.test(line)) {
        // Extract session name: [HH:MM:SS] → <session>  session_death
        const m = /→\s+([\w-]+)\s+session_death/.exec(line);
        if (m?.[1]) deaths.add(m[1]);
      }
    }
  } catch {
    // Feed unavailable — don't block agent listing
  }
  return deaths;
}

export async function listAgents(): Promise<Agent[]> {
  let stdout: string;
  try {
    const result = await exec(
      "tmux",
      ["list-sessions", "-F", "#{session_name}:#{session_created}:#{session_activity}"],
      { timeoutMs: 5_000 }
    );
    stdout = result.stdout;
  } catch {
    return [];
  }

const prefixMap = await loadPrefixToRigMap();
  const recentDeaths = await getRecentDeaths();

  const agents: Agent[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const [session, createdStr, activityStr] = line.split(":");
    if (!session) continue;
    const parsed = parseSession(session);
    if (!parsed) continue;

    const created = new Date(Number(createdStr) * 1000).toISOString();
    const activity = new Date(Number(activityStr) * 1000).toISOString();
    const ageSec = (Date.now() - Number(activityStr) * 1000) / 1000;

    let status: Agent["status"];
    if (ageSec > IDLE_THRESHOLD_SEC) {
      // If the session recently died and is idle, it's recovering (not dead yet)
      status = recentDeaths.has(session) ? "recovering" : "idle";
    } else {
      status = "working";
    }

    agents.push({
      name: parsed.agentName,
      rig: parsed.rig,
      role: parsed.role,
      session,
      status,
      startedAt: created,
      lastActivity: activity,
    });
  }

  // Populate currentWork from hooked beads in parallel
  await Promise.all(
    agents.map(async (agent) => {
      const rigName = prefixMap.get(agent.rig) ?? agent.rig;
      const target = hookTarget(rigName, agent.role, agent.name);
      agent.currentWork = await getHookedWork(target);
    })
  );

  return agents;
}

export async function listAgentsForRig(rigName: string): Promise<Agent[]> {
  const all = await listAgents();
  return all.filter((a) => a.rig === rigName);
}

export async function getAgentPreview(sessionName: string, lines = 5): Promise<string> {
  return getSessionOutput(sessionName, lines);
}

export async function getAgentOutput(sessionName: string, lines = 20): Promise<string> {
  return getSessionOutput(sessionName, lines);
}
