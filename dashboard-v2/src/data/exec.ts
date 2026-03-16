import { execFile } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export class ExecError extends Error {
  constructor(
    public readonly command: string,
    public readonly stderr: string,
    public readonly exitCode: number | null
  ) {
    super(`Command failed: ${command} (exit ${exitCode})\n${stderr}`);
    this.name = "ExecError";
  }
}

export async function exec(
  command: string,
  args: string[],
  options?: { cwd?: string; timeoutMs?: number }
): Promise<ExecResult> {
  const timeout = options?.timeoutMs ?? 10_000;
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd: options?.cwd, timeout, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new ExecError(
              `${command} ${args.join(" ")}`,
              stderr,
              error.code !== undefined ? Number(error.code) : null
            )
          );
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}
