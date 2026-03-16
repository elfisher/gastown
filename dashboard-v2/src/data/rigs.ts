import { config } from "../config.js";
import { exec } from "./exec.js";
import { RigListSchema, type Rig } from "./schemas.js";

export async function listRigs(): Promise<Rig[]> {
  const result = await exec("gt", ["rig", "list", "--json"], {
    cwd: config.townRoot,
  });
  return RigListSchema.parse(JSON.parse(result.stdout));
}
