import { exec } from "./exec.js";
import { cached } from "./cache.js";
import { ConvoyListSchema, ConvoySchema, type Convoy } from "./schemas.js";
import { getGtRoot } from "../config.js";

export async function listConvoys(includeAll = false): Promise<Convoy[]> {
  const cacheKey = includeAll ? "convoys:all" : "convoys:active";
  return cached(cacheKey, 10_000, async () => {
    const root = getGtRoot();
    try {
      const args = ["convoy", "list", "--json"];
      if (includeAll) args.push("--all");
      const { stdout } = await exec("gt", args, { cwd: root });
      const parsed = JSON.parse(stdout);
      return ConvoyListSchema.parse(Array.isArray(parsed) ? parsed : []);
    } catch {
      return [];
    }
  });
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
