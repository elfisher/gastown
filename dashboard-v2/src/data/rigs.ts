import { exec } from "./exec.js";
import { RigListSchema, type Rig } from "./schemas.js";
import { getGtRoot } from "../config.js";

export async function listRigs(): Promise<Rig[]> {
  const root = getGtRoot();
  const { stdout } = await exec("gt", ["rig", "list", "--json"], { cwd: root });
  return RigListSchema.parse(JSON.parse(stdout));
}

export async function getRig(name: string): Promise<Rig | undefined> {
  const rigs = await listRigs();
  return rigs.find((r) => r.name === name);
}
