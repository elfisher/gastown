import { exec } from "./exec.js";
import { getGtRoot } from "../config.js";

export interface FileChange {
  file: string;
  additions: number;
  deletions: number;
  diff: string;
}

export interface BranchInfo {
  branch: string;
  commits: { hash: string; message: string; date: string }[];
  files: FileChange[];
}

/**
 * Find the most recent remote branch for a bead ID within a rig.
 * Branch pattern: polecat/<name>/<bead-id>@<suffix>
 */
async function findBeadBranch(rigName: string, beadId: string): Promise<string | null> {
  const root = getGtRoot();
  const cwd = `${root}/${rigName}`;
  try {
    const { stdout } = await exec("git", ["branch", "-r", "--sort=-committerdate"], { cwd, timeoutMs: 5_000 });
    for (const line of stdout.split("\n")) {
      const name = line.trim();
      // Match origin/polecat/<agent>/<beadId>@<suffix>
      if (name.startsWith("origin/polecat/") && name.includes(`/${beadId}@`)) {
        return name;
      }
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Get branch info (commits + file diffs) for a bead's branch vs a base branch.
 */
export async function getBeadBranchInfo(
  rigName: string,
  beadId: string,
  baseBranch = "main",
): Promise<BranchInfo | null> {
  const branch = await findBeadBranch(rigName, beadId);
  if (!branch) return null;

  const root = getGtRoot();
  const cwd = `${root}/${rigName}`;
  const range = `origin/${baseBranch}...${branch}`;

  // Get commits
  const commits: BranchInfo["commits"] = [];
  try {
    const { stdout } = await exec(
      "git", ["log", range, "--pretty=format:%h\t%s\t%ci", "--no-merges"],
      { cwd, timeoutMs: 10_000 },
    );
    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      const [hash, message, date] = line.split("\t");
      if (hash && message) commits.push({ hash, message, date: date ?? "" });
    }
  } catch { /* ignore */ }

  // Get file stats (numstat)
  const files: FileChange[] = [];
  try {
    const { stdout: statOut } = await exec(
      "git", ["diff", "--numstat", range],
      { cwd, timeoutMs: 10_000 },
    );
    // Get full diff for content
    const { stdout: diffOut } = await exec(
      "git", ["diff", range, "--no-color"],
      { cwd, timeoutMs: 15_000 },
    );
    const diffByFile = parseDiffByFile(diffOut);

    for (const line of statOut.split("\n")) {
      if (!line.trim()) continue;
      const [add, del, file] = line.split("\t");
      if (!file) continue;
      files.push({
        file,
        additions: parseInt(add ?? "0", 10) || 0,
        deletions: parseInt(del ?? "0", 10) || 0,
        diff: diffByFile.get(file) ?? "",
      });
    }
  } catch { /* ignore */ }

  return { branch, commits, files };
}

/** Split a unified diff into per-file chunks keyed by filename. */
function parseDiffByFile(diff: string): Map<string, string> {
  const result = new Map<string, string>();
  const chunks = diff.split(/^diff --git /m);
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    // First line: a/path b/path
    const m = /^a\/(.+?) b\//.exec(chunk);
    if (m) {
      result.set(m[1]!, "diff --git " + chunk);
    }
  }
  return result;
}
