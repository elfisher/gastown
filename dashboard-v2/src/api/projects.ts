import type { FastifyInstance } from "fastify";
import { getProjectsData } from "../data/projects.js";
import { renderProjectsContent } from "../pages/projects.js";

export async function registerProjectsApi(
  app: FastifyInstance
): Promise<void> {
  app.get<{ Querystring: { search?: string; status?: string; priority?: string } }>(
    "/api/projects",
    async (req, reply) => {
      const data = await getProjectsData({
        search: req.query.search || undefined,
        status: req.query.status || undefined,
        priority: req.query.priority ? parseInt(req.query.priority, 10) : undefined,
      });
      return reply.type("text/html").send(renderProjectsContent(data));
    }
  );
}
