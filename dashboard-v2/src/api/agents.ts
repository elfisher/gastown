import type { FastifyInstance } from "fastify";
import { listAgents, getAgentPreview, getAgentOutput } from "../data/agents.js";
import { renderAgentCards, renderAgentOutput } from "../pages/agents.js";

export async function registerAgentsApi(app: FastifyInstance): Promise<void> {
  app.get("/api/agents", async (_req, reply) => {
    const agents = await listAgents();
    for (const a of agents) {
      a.preview = await getAgentPreview(a.session);
    }
    return reply.type("text/html").send(renderAgentCards(agents));
  });

  app.get<{ Params: { name: string } }>(
    "/api/agents/:name/preview",
    async (req, reply) => {
      const preview = await getAgentPreview(req.params.name);
      return reply.type("text/html").send(
        `<pre class="text-xs whitespace-pre-wrap">${preview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`
      );
    }
  );

  app.get<{ Params: { name: string } }>(
    "/api/agents/:name/output",
    async (req, reply) => {
      const output = await getAgentOutput(req.params.name, 20);
      return reply.type("text/html").send(renderAgentOutput(output));
    }
  );
}
