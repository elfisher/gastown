import { exec } from "./exec.js";
import { BeadListSchema, type Bead, type Convoy } from "./schemas.js";
import { listConvoys } from "./convoys.js";
import { getGtRoot } from "../config.js";

export interface ProjectItem {
  id: string;
  name: string;
  type: "convoy" | "epic";
  status: string;
  beads: Bead[];
  total: number;
  closed: number;
  hooked: number;
}

export interface ProjectsData {
  projects: ProjectItem[];
  total: number;
}

function beadProgress(beads: Bead[]): { total: number; closed: number; hooked: number } {
  let closed = 0;
  let hooked = 0;
  for (const b of beads) {
    if (b.status === "closed") closed++;
    else if (b.status === "hooked" || b.status === "in_progress") hooked++;
  }
  return { total: beads.length, closed, hooked };
}

export async function getProjectsData(filters?: {
  search?: string;
  status?: string;
  priority?: number;
}): Promise<ProjectsData> {
  const root = getGtRoot();

  // Fetch all beads including epics
  let allBeads: Bead[];
  try {
    const { stdout } = await exec("bd", ["list", "--status=all", "--json"], {
      cwd: root,
      timeoutMs: 15_000,
    });
    allBeads = BeadListSchema.parse(JSON.parse(stdout));
  } catch {
    allBeads = [];
  }

  // Filter out internal wisps and agent beads for child listing
  const workBeads = allBeads.filter(
    (b) =>
      !b.labels?.includes("gt:agent") &&
      !b.id.includes("-wisp-") &&
      b.issue_type !== "epic"
  );

  // Get epics
  const epics = allBeads.filter(
    (b) => b.issue_type === "epic" && !b.id.includes("-wisp-")
  );

  // Get convoys
  let convoys: Convoy[];
  try {
    convoys = await listConvoys();
  } catch {
    convoys = [];
  }

  const projects: ProjectItem[] = [];

  // Build convoy-based projects
  const convoyBeadIds = new Set<string>();
  for (const c of convoys) {
    const issueIds = c.issues ?? [];
    const beads = workBeads.filter((b) => issueIds.includes(b.id));
    for (const id of issueIds) convoyBeadIds.add(id);
    const prog = beadProgress(beads);
    projects.push({
      id: c.id,
      name: c.name,
      type: "convoy",
      status: c.status,
      beads,
      ...prog,
    });
  }

  // Build epic-based projects (only if not already covered by a convoy)
  for (const epic of epics) {
    if (convoyBeadIds.has(epic.id)) continue;
    // Find children: beads that depend on this epic (heuristic: same prefix, matching labels)
    // For now, show the epic itself as a project with no children
    projects.push({
      id: epic.id,
      name: epic.title,
      type: "epic",
      status: epic.status,
      beads: [],
      total: 0,
      closed: 0,
      hooked: 0,
    });
  }

  // Apply filters
  let filtered = projects;
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.beads.some(
          (b) =>
            b.title.toLowerCase().includes(q) || b.id.toLowerCase().includes(q)
        )
    );
  }
  if (filters?.status) {
    filtered = filtered.filter((p) => p.status === filters.status);
  }
  if (filters?.priority !== undefined) {
    filtered = filtered.filter((p) =>
      p.beads.some((b) => b.priority <= filters.priority!)
    );
  }

  return { projects: filtered, total: filtered.length };
}
