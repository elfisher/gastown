import { exec } from "./exec.js";
import { BeadListSchema, BeadDetailSchema, type Bead, type BeadDetail, type BeadHistoryEntry } from "./schemas.js";
import { getGtRoot } from "../config.js";

export async function listBeads(rig?: string): Promise<Bead[]> {
  const root = getGtRoot();
  const cwd = rig ? `${root}/${rig}` : root;
  try {
    const { stdout } = await exec("bd", ["list", "--json"], { cwd });
    return BeadListSchema.parse(JSON.parse(stdout));
  } catch {
    return [];
  }
}

export async function getBead(id: string): Promise<BeadDetail> {
  const root = getGtRoot();
  const { stdout } = await exec("bd", ["show", id, "--json"], { cwd: root });
  const arr = JSON.parse(stdout);
  return BeadDetailSchema.parse(Array.isArray(arr) ? arr[0] : arr);
}

export async function getBeadDeps(id: string): Promise<{ dependencies: BeadDetail["dependencies"]; dependents: BeadDetail["dependents"] }> {
  const bead = await getBead(id);
  return { dependencies: bead.dependencies, dependents: bead.dependents };
}

export async function getBeadHistory(id: string): Promise<BeadHistoryEntry[]> {
  const root = getGtRoot();
  try {
    const { stdout } = await exec("bd", ["history", id, "--json"], { cwd: root });
    const raw = JSON.parse(stdout);
    if (!Array.isArray(raw)) return [];
    // Deduplicate by status change — consecutive entries with same status are noise
    const entries: BeadHistoryEntry[] = [];
    let lastStatus = "";
    for (const item of raw) {
      const status = item.Issue?.status ?? "unknown";
      if (status !== lastStatus) {
        entries.push({
          date: item.CommitDate ?? "",
          committer: item.Committer ?? "",
          status,
        });
        lastStatus = status;
      }
    }
    return entries;
  } catch {
    return [];
  }
}
