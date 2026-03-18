import type { FastifyInstance } from "fastify";
import { listRigs } from "./data/rigs.js";
import { getMayorMessages } from "./data/mayor.js";
import { getPipelineData } from "./data/pipeline.js";
import { listAgents, getAgentPreview, getAgentOutput } from "./data/agents.js";
import { listConvoys } from "./data/convoys.js";
import { renderLayout } from "./pages/layout.js";
import { renderMayorPage } from "./pages/mayor.js";
import { renderPipelinePage } from "./pages/pipeline.js";
import { registerMayorApi } from "./api/mayor.js";
import { renderRigPage } from "./pages/rig.js";
import { renderConvoyPage } from "./pages/convoy.js";
import { renderBeadPage } from "./pages/bead.js";
import { renderConvoyListPage } from "./pages/convoy-list.js";
import { registerPipelineApi } from "./api/pipeline.js";
import { renderAgentsPage, renderAgentDetailPage } from "./pages/agents.js";
import { renderTourPage } from "./pages/tour.js";
import { registerAgentsApi } from "./api/agents.js";
import { registerProjectsApi } from "./api/projects.js";
import { getProjectsData } from "./data/projects.js";
import { renderProjectsPage } from "./pages/projects.js";
import type { Rig } from "./data/schemas.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  async function withLayout(
    title: string,
    content: string,
    activePath?: string
  ): Promise<string> {
    let rigs: Rig[];
    try {
      rigs = await listRigs();
    } catch {
      rigs = [];
    }
    return renderLayout(title, content, rigs, activePath);
  }

  function placeholder(name: string): string {
    return `<div class="prose"><h1>${name}</h1><p class="text-base-content/60">Coming soon</p></div>`;
  }

  app.get("/", async (req, reply) => {
    const rig = (req.query as Record<string, string>).rig || undefined;
    const priority = (req.query as Record<string, string>).priority || undefined;
    const data = await getPipelineData({
      rig,
      priority: priority ? parseInt(priority, 10) : undefined,
    });
    const html = await withLayout(
      "Pipeline",
      renderPipelinePage(data, rig, priority),
      "/"
    );
    return reply.type("text/html").send(html);
  });

  app.get("/pipeline", async (req, reply) => {
    const rig = (req.query as Record<string, string>).rig || undefined;
    const priority = (req.query as Record<string, string>).priority || undefined;
    const data = await getPipelineData({
      rig,
      priority: priority ? parseInt(priority, 10) : undefined,
    });
    const html = await withLayout(
      "Pipeline",
      renderPipelinePage(data, rig, priority),
      "/pipeline"
    );
    return reply.type("text/html").send(html);
  });

  app.get("/agents", async (_req, reply) => {
    const agents = await listAgents();
    for (const a of agents) {
      a.preview = await getAgentPreview(a.session);
    }
    const html = await withLayout(
      "Agents",
      renderAgentsPage(agents),
      "/agents"
    );
    return reply.type("text/html").send(html);
  });

  app.get("/mayor", async (_req, reply) => {
    const messages = await getMayorMessages();
    const html = await withLayout(
      "Mayor",
      renderMayorPage(messages),
      "/mayor"
    );
    return reply.type("text/html").send(html);
  });

  app.get("/tour", async (_req, reply) => {
    const html = await withLayout("Tour", renderTourPage(), "/tour");
    return reply.type("text/html").send(html);
  });

  app.get("/convoys", async (req, reply) => {
    const all = (req.query as Record<string, string>).all === "true";
    const convoys = await listConvoys(all);
    const html = await withLayout(
      "Convoys",
      renderConvoyListPage(convoys, all),
      "/convoys"
    );
    return reply.type("text/html").send(html);
  });

  app.get("/overview", async (req, reply) => {
    const search = (req.query as Record<string, string>).search || undefined;
    const status = (req.query as Record<string, string>).status || undefined;
    const data = await getProjectsData({ search, status });
    const html = await withLayout(
      "Project Overview",
      renderProjectsPage(data, search, status),
      "/overview"
    );
    return reply.type("text/html").send(html);
  });

  app.get("/projects", async (req, reply) => {
    const search = (req.query as Record<string, string>).search || undefined;
    const status = (req.query as Record<string, string>).status || undefined;
    const data = await getProjectsData({ search, status });
    const html = await withLayout(
      "Project Overview",
      renderProjectsPage(data, search, status),
      "/overview"
    );
    return reply.type("text/html").send(html);
  });

  app.get<{ Params: { name: string } }>(
    "/rig/:name",
    async (req, reply) => {
      const name = req.params.name;
      const content = await renderRigPage(name);
      const html = await withLayout(`Rig: ${name}`, content, `/rig/${name}`);
      return reply.type("text/html").send(html);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/convoy/:id",
    async (req, reply) => {
      const id = req.params.id;
      const content = await renderConvoyPage(id);
      const html = await withLayout(`Convoy: ${id}`, content);
      return reply.type("text/html").send(html);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/bead/:id",
    async (req, reply) => {
      const id = req.params.id;
      const content = await renderBeadPage(id);
      const html = await withLayout(`Bead: ${id}`, content);
      return reply.type("text/html").send(html);
    }
  );

  app.get<{ Params: { name: string } }>(
    "/agent/:name",
    async (req, reply) => {
      const sessionName = req.params.name;
      const agents = await listAgents();
      const agent = agents.find((a) => a.session === sessionName);
      if (!agent) {
        const safe = sessionName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html = await withLayout(
          "Agent Not Found",
          `<div class="prose"><h1>Agent Not Found</h1><p>${safe} is not an active session.</p></div>`
        );
        return reply.status(404).type("text/html").send(html);
      }
      const output = await getAgentOutput(sessionName, 20);
      const html = await withLayout(
        `Agent: ${agent.name}`,
        renderAgentDetailPage(agent, output),
        "/agents"
      );
      return reply.type("text/html").send(html);
    }
  );

  // API endpoints
  await registerMayorApi(app);
  await registerPipelineApi(app);
  await registerAgentsApi(app);
  await registerProjectsApi(app);
}
