import type { FastifyInstance } from "fastify";
import { listRigs } from "./data/rigs.js";
import { renderLayout } from "./pages/layout.js";
import type { Rig } from "./data/schemas.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Cache rigs for nav (refreshed per request — cheap CLI call)
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
    return `<div class="prose"><h1>${name}</h1><p class="text-base-content/60">Coming soon — Phase 2+</p></div>`;
  }

  app.get("/", async (_req, reply) => {
    const html = await withLayout("Pipeline", placeholder("Pipeline"), "/");
    return reply.type("text/html").send(html);
  });

  app.get("/pipeline", async (_req, reply) => {
    const html = await withLayout(
      "Pipeline",
      placeholder("Pipeline"),
      "/pipeline"
    );
    return reply.type("text/html").send(html);
  });

  app.get("/agents", async (_req, reply) => {
    const html = await withLayout("Agents", placeholder("Agents"), "/agents");
    return reply.type("text/html").send(html);
  });

  app.get("/mayor", async (_req, reply) => {
    const html = await withLayout("Mayor", placeholder("Mayor"), "/mayor");
    return reply.type("text/html").send(html);
  });

  app.get("/tour", async (_req, reply) => {
    const html = await withLayout("Tour", placeholder("Tour"), "/tour");
    return reply.type("text/html").send(html);
  });

  app.get<{ Params: { name: string } }>(
    "/rig/:name",
    async (req, reply) => {
      const name = req.params.name;
      const html = await withLayout(
        `Rig: ${name}`,
        placeholder(`Rig: ${name}`),
        `/rig/${name}`
      );
      return reply.type("text/html").send(html);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/convoy/:id",
    async (req, reply) => {
      const id = req.params.id;
      const html = await withLayout(
        `Convoy: ${id}`,
        placeholder(`Convoy: ${id}`)
      );
      return reply.type("text/html").send(html);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/bead/:id",
    async (req, reply) => {
      const id = req.params.id;
      const html = await withLayout(
        `Bead: ${id}`,
        placeholder(`Bead: ${id}`)
      );
      return reply.type("text/html").send(html);
    }
  );

  app.get<{ Params: { name: string } }>(
    "/agent/:name",
    async (req, reply) => {
      const name = req.params.name;
      const html = await withLayout(
        `Agent: ${name}`,
        placeholder(`Agent: ${name}`)
      );
      return reply.type("text/html").send(html);
    }
  );
}
