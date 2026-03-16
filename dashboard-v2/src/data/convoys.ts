import { exec } from "./exec.js";
import { ConvoyListSchema, ConvoySchema, type Convoy } from "./schemas.js";
import { getGtRoot } from "../config.js";

export async function listConvoys(): Promise<Convoy[]> {
  const root = getGtRoot();
  try {
    const { stdout } = await exec("gt", ["convoy", "list", "--json", "--all"], { cwd: root });
    const parsed = JSON.parse(stdout);
    return ConvoyListSchema.parse(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

export async function getConvoy(id: string): Promise<Convoy> {
  const root = getGtRoot();
  const { stdout } = await exec("gt", ["convoy", "show", id, "--json"], { cwd: root });
  const parsed = JSON.parse(stdout);
  return ConvoySchema.parse(Array.isArray(parsed) ? parsed[0] : parsed);
}

export async function getConvoyBeads(convoyId: string): Promise<string[]> {
  try {
    const convoy = await getConvoy(convoyId);
    return convoy.issues ?? [];
  } catch {
    return [];
  }
}
