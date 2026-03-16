import { exec } from "./exec.js";
import { AgentListSchema, type Agent } from "./schemas.js";
import { getGtRoot } from "../config.js";

export async function listAgents(): Promise<Agent[]> {
  const root = getGtRoot();
  try {
    const { stdout } = await exec("gt", ["agents", "list", "--all"], { cwd: root });
    return parseAgentList(stdout);
  } catch {
    return [];
  }
}

function parseAgentList(text: string): Agent[] {
  const agents: Agent[] = [];
  let currentRig = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const rigMatch = /^──\s+(\S+)\s+──$/.exec(trimmed);
    if (rigMatch) {
      currentRig = rigMatch[1] ?? "";
      continue;
    }
    const agentMatch = /^\S+\s+(.+)$/.exec(trimmed);
    if (agentMatch) {
      const raw = agentMatch[1] ?? "";
      const name = raw.replace(/\s*\(.*\)$/, "").trim();
      const role = inferRole(name, trimmed);
      agents.push({ name, rig: currentRig || undefined, role, status: undefined, session_id: undefined });
    }
  }
  return AgentListSchema.parse(agents);
}

function inferRole(name: string, line: string): string {
  if (line.includes("🎩")) return "mayor";
  if (line.includes("🐺")) return "deacon";
  if (line.includes("🏭")) return "refinery";
  if (line.includes("🦉")) return "witness";
  if (line.includes("🦨")) return "polecat";
  return name.toLowerCase();
}

export async function listAgentsForRig(rigName: string): Promise<Agent[]> {
  const all = await listAgents();
  return all.filter((a) => a.rig === rigName);
}
