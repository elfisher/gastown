import { exec } from "./exec.js";
import type { Agent } from "./schemas.js";

const SYSTEM_ROLES = new Map<string, Agent["role"]>([
  ["mayor", "mayor"],
  ["deacon", "deacon"],
  ["witness", "witness"],
  ["refinery", "refinery"],
  ["boot", "boot"],
]);

function parseSession(name: string): { rig: string; role: Agent["role"]; agentName: string } | null {
  const dash = name.indexOf("-");
  if (dash < 0) return null;
  const prefix = name.slice(0, dash);
  const suffix = name.slice(dash + 1);
  const role = SYSTEM_ROLES.get(suffix) ?? "polecat";
  return { rig: prefix, role, agentName: suffix };
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
    const status: Agent["status"] = ageSec > 600 ? "idle" : "working";

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
  return agents;
}

export async function listAgentsForRig(rigName: string): Promise<Agent[]> {
  const all = await listAgents();
  return all.filter((a) => a.rig === rigName);
}

export async function getAgentPreview(sessionName: string, lines = 5): Promise<string> {
  try {
    const result = await exec(
      "tmux",
      ["capture-pane", "-t", sessionName, "-p", "-S", `-${lines}`],
      { timeoutMs: 5_000 }
    );
    return result.stdout.trimEnd();
  } catch {
    return "(session not available)";
  }
}

export async function getAgentOutput(sessionName: string, lines = 20): Promise<string> {
  try {
    const result = await exec(
      "tmux",
      ["capture-pane", "-t", sessionName, "-p", "-S", `-${lines}`],
      { timeoutMs: 5_000 }
    );
    return result.stdout.trimEnd();
  } catch {
    return "(session not available)";
  }
}
