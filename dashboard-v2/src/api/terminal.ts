/**
 * Terminal WebSocket + raw-capture API.
 *
 * - GET /ws/terminal/:session  → WebSocket ↔ tmux via node-pty (interactive)
 * - GET /api/terminal/:session/raw → raw capture-pane output (read-only)
 */

import type { FastifyInstance } from "fastify";
import type { IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
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
 * Register the interactive WebSocket terminal endpoint.
 *
 * Bridges browser ↔ tmux session via node-pty. On disconnect the pty is
 * killed (which detaches from tmux — it does NOT kill the tmux session).
 */
export async function registerTerminalWs(app: FastifyInstance): Promise<void> {
  const server = app.server;

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const match = url.pathname.match(/^\/ws\/terminal\/([^/]+)$/);
    if (!match) return; // not ours — let other upgrade handlers (if any) deal with it

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

    let ptyProcess: pty.IPty;
    try {
      ptyProcess = pty.spawn("tmux", ["attach-session", "-t", session], {
        name: "xterm-256color",
        cols: 120,
        rows: 40,
        env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
      });
    } catch (err) {
      ws.close(4005, `Failed to attach: ${err}`);
      return;
    }

    // pty → browser
    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ptyProcess.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "pty exited");
      }
    });

    // browser → pty
    ws.on("message", (msg) => {
      const data = typeof msg === "string" ? msg : msg.toString("utf-8");

      // Handle resize messages: JSON { type: "resize", cols, rows }
      try {
        const parsed = JSON.parse(data) as { type?: string; cols?: number; rows?: number };
        if (parsed.type === "resize" && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch {
        // Not JSON — treat as keystroke data
      }

      ptyProcess.write(data);
    });

    ws.on("close", () => {
      ptyProcess.kill();
    });

    ws.on("error", () => {
      ptyProcess.kill();
    });
  });
}

/**
 * Register the read-only raw terminal capture endpoint.
 *
 * Returns raw `tmux capture-pane` output with ANSI escape sequences preserved
 * so xterm.js can render them natively.
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
