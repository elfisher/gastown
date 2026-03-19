/**
 * Terminal WebSocket + raw-capture API.
 *
 * - GET /ws/terminal/:session  → WebSocket ↔ tmux via control mode (interactive)
 * - GET /api/terminal/:session/raw → raw capture-pane output (read-only)
 *
 * Uses tmux control mode (-C) instead of node-pty to avoid macOS posix_spawn
 * restrictions. Control mode gives structured %output events over stdin/stdout.
 */

import type { FastifyInstance } from "fastify";
import type { IncomingMessage } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { WebSocketServer, WebSocket } from "ws";
import { exec } from "../data/exec.js";

/** Sanitise a tmux session name to prevent injection. */
function sanitizeSession(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.:-]/g, "");
}

/** Check if a tmux session exists. */
async function sessionExists(session: string): Promise<boolean> {
  try {
    await exec("tmux", ["has-session", "-t", session], { timeoutMs: 3_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse tmux control mode %output lines.
 * Format: %output %<pane-id> <escaped-data>
 * The data uses C-style escapes: \033 for ESC, \015 for CR, etc.
 */
function parseControlOutput(line: string): string | null {
  const match = line.match(/^%output %\S+ (.*)$/);
  if (!match?.[1]) return null;
  return match[1]
    .replace(/\\033/g, "\x1b")
    .replace(/\\015/g, "\r")
    .replace(/\\012/g, "\n")
    .replace(/\\007/g, "\x07")
    .replace(/\\010/g, "\b")
    .replace(/\\011/g, "\t")
    .replace(/\\\\/g, "\\");
}

/**
 * Register the interactive WebSocket terminal endpoint.
 *
 * Uses tmux control mode (-C) which communicates over stdin/stdout
 * without needing a pty. Keystrokes are sent via tmux send-keys.
 */
export async function registerTerminalWs(app: FastifyInstance): Promise<void> {
  const server = app.server;
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const match = url.pathname.match(/^\/ws\/terminal\/([^/]+)$/);
    if (!match) return;

    const session = sanitizeSession(match[1]!);
    if (!session) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, session);
    });
  });

  wss.on("connection", async (ws: WebSocket, _req: IncomingMessage, session: string) => {
    const exists = await sessionExists(session);
    if (!exists) {
      ws.close(4004, `tmux session "${session}" not found`);
      return;
    }

    let tmuxProc: ChildProcess;
    try {
      tmuxProc = spawn("tmux", ["-C", "attach-session", "-t", session], {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      ws.close(4005, `Failed to attach: ${err}`);
      return;
    }

    let buffer = "";

    // tmux control mode stdout → parse %output → send to browser
    tmuxProc.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const data = parseControlOutput(line);
        if (data && ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      }
    });

    tmuxProc.on("exit", () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "tmux exited");
      }
    });

    // browser → tmux: send keystrokes via send-keys
    ws.on("message", (msg) => {
      const data = typeof msg === "string" ? msg : msg.toString("utf-8");

      // Handle resize messages
      try {
        const parsed = JSON.parse(data) as { type?: string; cols?: number; rows?: number };
        if (parsed.type === "resize" && parsed.cols && parsed.rows) {
          tmuxProc.stdin?.write(`resize-window -t ${session} -x ${parsed.cols} -y ${parsed.rows}\n`);
          return;
        }
      } catch {
        // Not JSON — treat as keystroke data
      }

      // Escape special characters for send-keys
      // tmux control mode accepts commands on stdin
      const escaped = data
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/;/g, "\\;");
      tmuxProc.stdin?.write(`send-keys -t ${session} -l "${escaped}"\n`);
    });

    ws.on("close", () => {
      tmuxProc.stdin?.write("detach\n");
      tmuxProc.kill();
    });

    ws.on("error", () => {
      tmuxProc.stdin?.write("detach\n");
      tmuxProc.kill();
    });

    // Send initial capture so the terminal isn't blank
    try {
      const initial = await exec(
        "tmux",
        ["capture-pane", "-t", session, "-p", "-e"],
        { timeoutMs: 3_000 },
      );
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(initial.stdout);
      }
    } catch {
      // Non-fatal — live output will follow
    }
  });
}

/**
 * Register the read-only raw terminal capture endpoint.
 */
export async function registerTerminalApi(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { session: string } }>(
    "/api/terminal/:session/raw",
    async (req, reply) => {
      const session = sanitizeSession(req.params.session);
      if (!session) {
        return reply.status(400).send("Invalid session name");
      }

      const exists = await sessionExists(session);
      if (!exists) {
        return reply.status(404).send("Session not found");
      }

      try {
        const result = await exec(
          "tmux",
          ["capture-pane", "-t", session, "-p", "-e"],
          { timeoutMs: 5_000 },
        );
        return reply.type("text/plain").send(result.stdout);
      } catch {
        return reply.status(500).send("Failed to capture pane");
      }
    },
  );
}
