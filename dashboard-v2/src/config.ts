import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

export function getGtRoot(): string {
  if (process.env["GT_ROOT"]) {
    return process.env["GT_ROOT"];
  }
  const defaultRoot = resolve(homedir(), "gt");
  if (existsSync(defaultRoot)) {
    return defaultRoot;
  }
  throw new Error(
    "Cannot detect Gas Town root. Set GT_ROOT env or ensure ~/gt exists.",
  );
}
