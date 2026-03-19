import { join } from "node:path";
import { config } from "../config.js";
import { exec } from "./exec.js";
import { cached } from "./cache.js";
import { RigListSchema, MergeQueueSchema, type Rig, type MergeQueueItem, type RepoInfo } from "./schemas.js";

export async function listRigs(): Promise<Rig[]> {
  return cached("rigs:list", async () => {
    const result = await exec("gt", ["rig", "list", "--json"], {
      cwd: config.townRoot,
    });
    return RigListSchema.parse(JSON.parse(result.stdout));
  }, 30_000);
}

export async function getRig(name: string): Promise<Rig | undefined> {
  const rigs = await listRigs();
  return rigs.find((r) => r.name === name);
}

export async function getRigRepoInfo(name: string): Promise<RepoInfo | undefined> {
  const rigDir = join(config.townRoot, name, "refinery", name);
  try {
    const { stdout: url } = await exec("git", ["remote", "get-url", "origin"], { cwd: rigDir });
    const { stdout: branch } = await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: rigDir });
    return { url: url.trim(), branch: branch.trim() };
  } catch {
    return undefined;
  }
}

export async function getMergeQueue(name: string): Promise<MergeQueueItem[]> {
  return cached(`rigs:mq:${name}`, async () => {
    try {
      const result = await exec("gt", ["mq", "list", name, "--json"], {
        cwd: config.townRoot,
      });
      const parsed = JSON.parse(result.stdout);
      if (!Array.isArray(parsed)) return [];
      return MergeQueueSchema.parse(parsed);
    } catch {
      return [];
    }
  });
}
