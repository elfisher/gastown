import { exec } from "./exec.js";
import { AgentListSchema, type Agent } from "./schemas.js";
import { getGtRoot } from "../config.js";

// gt agents list outputs plain text, not JSON. Parse it.
export async function listAgents(): Promise<Agent[]> {
  const root = getGtRoot();
  const { stdout } = await exec("gt", ["agents", "list", "--all"], { cwd: root });
  return parseAgentList(stdout);
}

function parseAgentList(text: string): Agent[] {
  const agents: Agent[] = [];
  let currentRig = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Rig header: "── gastown ──"
    const rigMatch = /^──\s+(\S+)\s+──$/.exec(trimmed);
    if (rigMatch) {
      currentRig = rigMatch[1] ?? "";
      continue;
    }
    // Agent line: "  🎩 Mayor" or "  🏭 refinery" or "  🦨 furiosa (gt-52r)"
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

export async function getAgentPreview(name: string): Promise<string> {
  try {
    const { stdout } = await exec("tmux", ["capture-pane", "-t", name, "-p", "-l", "5"]);
    return stdout;
  } catch {
    return "";
  }
}

export async function getAgentDetail(name: string): Promise<string> {
  try {
    const { stdout } = await exec("tmux", ["capture-pane", "-t", name, "-p", "-l", "20"]);
    return stdout;
  } catch {
    return "";
  }
}
