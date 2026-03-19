import { z } from "zod";
import { config } from "../config.js";
import { exec } from "./exec.js";
import { cached } from "./cache.js";

export const BeadSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.number(),
  issue_type: z.string(),
  assignee: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  labels: z.array(z.string()).optional(),
  dependency_count: z.number().optional(),
  dependent_count: z.number().optional(),
});

export const BeadListSchema = z.array(BeadSchema);

export type Bead = z.infer<typeof BeadSchema>;

export interface StageGroup {
  name: string;
  beads: Bead[];
}

export interface PipelineData {
  stages: StageGroup[];
  rigs: string[];
  total: number;
}

/** Extract rig name from bead ID prefix (e.g. "gt-abc" → "gastown") */
function rigFromId(id: string): string {
  const dash = id.indexOf("-");
  return dash > 0 ? id.slice(0, dash) : "unknown";
}

export async function listBeads(filters?: {
  rig?: string;
  priority?: number;
}): Promise<Bead[]> {
  return cached("pipeline:beads", async () => {
    const args = ["list", "--status=all", "--json"];
    const result = await exec("bd", args, {
      cwd: config.townRoot,
      timeoutMs: 15_000,
    });
    let beads = BeadListSchema.parse(JSON.parse(result.stdout));

    // Filter out agent beads and wisps (internal)
    beads = beads.filter(
      (b) =>
        !b.labels?.includes("gt:agent") &&
        !b.id.includes("-wisp-") &&
        b.issue_type !== "epic"
    );
    return beads;
  }, 10_000).then((beads) => {
    let result = beads;
    if (filters?.rig) {
      result = result.filter((b) => rigFromId(b.id) === filters.rig);
    }
    if (filters?.priority !== undefined) {
      result = result.filter((b) => b.priority <= filters.priority!);
    }
    return result;
  });
}

const STAGE_ORDER = ["hooked", "open", "closed"];

export async function getPipelineData(filters?: {
  rig?: string;
  priority?: number;
}): Promise<PipelineData> {
  const beads = await listBeads(filters);

  const grouped = new Map<string, Bead[]>();
  for (const stage of STAGE_ORDER) grouped.set(stage, []);

  for (const b of beads) {
    const stage = STAGE_ORDER.includes(b.status) ? b.status : "open";
    grouped.get(stage)!.push(b);
  }

  const stages: StageGroup[] = STAGE_ORDER.map((name) => ({
    name,
    beads: grouped.get(name) ?? [],
  }));

  const rigs = [...new Set(beads.map((b) => rigFromId(b.id)))].sort();

  return { stages, rigs, total: beads.length };
}
