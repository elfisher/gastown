import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class ExecError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
    public readonly code: number | null,
  ) {
    super(message);
    this.name = "ExecError";
  }
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export async function exec(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; timeout?: number },
): Promise<ExecResult> {
  const timeout = opts?.timeout ?? 15_000;
  try {
    const result = await execFileAsync(cmd, args, {
      cwd: opts?.cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr ?? "" };
  } catch (err: unknown) {
    const e = err as { stderr?: string; code?: number | null; message?: string };
    throw new ExecError(
      e.message ?? `${cmd} failed`,
      e.stderr ?? "",
      e.code ?? null,
    );
  }
}
