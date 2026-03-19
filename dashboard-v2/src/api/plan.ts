import type { FastifyInstance } from "fastify";
import { exec } from "../data/exec.js";
import { config } from "../config.js";

export async function registerPlanApi(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { rig?: string; goal?: string } }>(
    "/api/plan",
    async (req, reply) => {
      const body = req.body as Record<string, unknown> | null;
      const rig = typeof body?.rig === "string" ? body.rig.trim() : "";
      const goal = typeof body?.goal === "string" ? body.goal.trim() : "";

      if (!rig || !goal) {
        return reply.status(400).send({ error: "rig and goal are required" });
      }

      try {
        await exec("gt", ["plan", rig, goal], {
          cwd: config.townRoot,
          timeoutMs: 30_000,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: msg });
      }

      return reply
        .status(200)
        .header("HX-Redirect", "/mayor")
        .send({ ok: true });
    }
  );
}
