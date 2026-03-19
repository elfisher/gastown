import type { FastifyInstance } from "fastify";
import { getPipelineData } from "../data/pipeline.js";
import { renderPipelineContent } from "../pages/pipeline.js";

export async function registerPipelineApi(
  app: FastifyInstance
): Promise<void> {
  app.get<{ Querystring: { rig?: string; priority?: string } }>(
    "/api/pipeline",
    async (req, reply) => {
      const rig = req.query.rig || undefined;
      const priority = req.query.priority
        ? parseInt(req.query.priority, 10)
        : undefined;
      const data = await getPipelineData({
        rig,
        priority: Number.isFinite(priority) ? priority : undefined,
      });
      return reply.type("text/html").send(renderPipelineContent(data));
    }
  );
}
