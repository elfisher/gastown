import { exec } from "./exec.js";
import { GitLogSchema, type GitDiff } from "./schemas.js";

export async function getGitLog(cwd: string, count = 20): Promise<GitDiff[]> {
  const { stdout } = await exec(
    "git",
    ["log", `--max-count=${count}`, "--format=%H%n%an%n%aI%n%s%n---"],
    { cwd },
  );
  const entries: GitDiff[] = [];
  const blocks = stdout.split("---\n").filter(Boolean);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length >= 4) {
      entries.push({
        hash: lines[0] ?? "",
        author: lines[1] ?? "",
        date: lines[2] ?? "",
        message: lines[3] ?? "",
      });
    }
  }
  return GitLogSchema.parse(entries);
}

export async function getGitDiff(cwd: string, ref?: string): Promise<string> {
  const args = ref ? ["diff", ref] : ["diff", "HEAD~1"];
  const { stdout } = await exec("git", args, { cwd });
  return stdout;
}
