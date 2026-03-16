import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const config = {
  port: parseInt(process.env["GT_DASHBOARD_PORT"] ?? "8081", 10),
  host: process.env["GT_DASHBOARD_HOST"] ?? "0.0.0.0",
  townRoot: detectTownRoot(),
};

function detectTownRoot(): string {
  if (process.env["GT_ROOT"]) return process.env["GT_ROOT"];
  const defaultPath = join(homedir(), "gt");
  if (existsSync(defaultPath)) return defaultPath;
  throw new Error(
    "Cannot detect Gas Town root. Set GT_ROOT or ensure ~/gt exists."
  );
}
