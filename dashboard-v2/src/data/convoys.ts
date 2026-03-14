import { exec } from "./exec.js";
import { ConvoyListSchema, ConvoySchema, type Convoy } from "./schemas.js";
import { getGtRoot } from "../config.js";

export async function listConvoys(): Promise<Convoy[]> {
  const root = getGtRoot();
  const { stdout } = await exec("gt", ["convoy", "list", "--json", "--all"], { cwd: root });
  const parsed = JSON.parse(stdout);
  return ConvoyListSchema.parse(Array.isArray(parsed) ? parsed : []);
}

export async function getConvoy(id: string): Promise<Convoy> {
  const root = getGtRoot();
  const { stdout } = await exec("gt", ["convoy", "show", id, "--json"], { cwd: root });
  const parsed = JSON.parse(stdout);
  return ConvoySchema.parse(Array.isArray(parsed) ? parsed[0] : parsed);
}
