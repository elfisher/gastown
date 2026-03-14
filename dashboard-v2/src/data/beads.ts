import { exec } from "./exec.js";
import { BeadListSchema, BeadDetailSchema, type Bead, type BeadDetail } from "./schemas.js";
import { getGtRoot } from "../config.js";

export async function listBeads(rig?: string): Promise<Bead[]> {
  const root = getGtRoot();
  const cwd = rig ? `${root}/${rig}` : root;
  const { stdout } = await exec("bd", ["list", "--json"], { cwd });
  return BeadListSchema.parse(JSON.parse(stdout));
}

export async function getBead(id: string): Promise<BeadDetail> {
  const root = getGtRoot();
  const { stdout } = await exec("bd", ["show", id, "--json"], { cwd: root });
  const arr = JSON.parse(stdout);
  // bd show --json returns an array with one element
  return BeadDetailSchema.parse(Array.isArray(arr) ? arr[0] : arr);
}

export async function getBeadDeps(id: string): Promise<{ dependencies: BeadDetail["dependencies"]; dependents: BeadDetail["dependents"] }> {
  const bead = await getBead(id);
  return { dependencies: bead.dependencies, dependents: bead.dependents };
}
