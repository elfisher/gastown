import type { FastifyInstance } from "fastify";
import { listRigs } from "./data/rigs.js";
import { renderLayout } from "./pages/layout.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Cache rigs for 30s to avoid shelling out on every request
  let rigsCache: Awaited<ReturnType<typeof listRigs>> = [];
  let rigsCacheTime = 0;

  async function getRigs() {
    const now = Date.now();
    if (now - rigsCacheTime > 30_000) {
      rigsCache = await listRigs();
      rigsCacheTime = now;
    }
    return rigsCache;
  }

  function page(title: string, content: string, rigs: Awaited<ReturnType<typeof listRigs>>, path: string) {
    return renderLayout(title, content, rigs, path);
  }

  app.get("/", async (_req, reply) => {
    const rigs = await getRigs();
    const content = `<h1 class="text-3xl font-bold mb-4">Overview</h1>
      <p class="text-base-content/70">Welcome to Gas Town Dashboard V2.</p>
      <div class="stats shadow mt-6">
        <div class="stat"><div class="stat-title">Rigs</div><div class="stat-value">${rigs.length}</div></div>
        <div class="stat"><div class="stat-title">Polecats</div><div class="stat-value">${rigs.reduce((s, r) => s + r.polecats, 0)}</div></div>
      </div>`;
    return reply.type("text/html").send(page("Overview", content, rigs, "/"));
  });

  app.get("/pipeline", async (_req, reply) => {
    const rigs = await getRigs();
    return reply.type("text/html").send(page("Pipeline", `<h1 class="text-3xl font-bold">Pipeline</h1><p class="mt-2 text-base-content/70">Pipeline view — coming soon.</p>`, rigs, "/pipeline"));
  });

  app.get("/agents", async (_req, reply) => {
    const rigs = await getRigs();
    return reply.type("text/html").send(page("Agents", `<h1 class="text-3xl font-bold">Agents</h1><p class="mt-2 text-base-content/70">Agent monitoring — coming soon.</p>`, rigs, "/agents"));
  });

  app.get("/mayor", async (_req, reply) => {
    const rigs = await getRigs();
    return reply.type("text/html").send(page("Mayor", `<h1 class="text-3xl font-bold">Mayor</h1><p class="mt-2 text-base-content/70">Mayor status — coming soon.</p>`, rigs, "/mayor"));
  });

  app.get<{ Params: { name: string } }>("/rig/:name", async (req, reply) => {
    const rigs = await getRigs();
    const rig = rigs.find((r) => r.name === req.params.name);
    const content = rig
      ? `<h1 class="text-3xl font-bold">${rig.name}</h1>
         <div class="stats shadow mt-4">
           <div class="stat"><div class="stat-title">Status</div><div class="stat-value text-sm">${rig.status}</div></div>
           <div class="stat"><div class="stat-title">Witness</div><div class="stat-value text-sm">${rig.witness}</div></div>
           <div class="stat"><div class="stat-title">Refinery</div><div class="stat-value text-sm">${rig.refinery}</div></div>
           <div class="stat"><div class="stat-title">Polecats</div><div class="stat-value">${rig.polecats}</div></div>
         </div>`
      : `<h1 class="text-3xl font-bold">Rig not found</h1>`;
    return reply.type("text/html").send(page(`Rig: ${req.params.name}`, content, rigs, `/rig/${req.params.name}`));
  });

  app.get<{ Params: { id: string } }>("/convoy/:id", async (req, reply) => {
    const rigs = await getRigs();
    return reply.type("text/html").send(page(`Convoy: ${req.params.id}`, `<h1 class="text-3xl font-bold">Convoy ${req.params.id}</h1><p class="mt-2 text-base-content/70">Convoy detail — coming soon.</p>`, rigs, ""));
  });

  app.get<{ Params: { id: string } }>("/bead/:id", async (req, reply) => {
    const rigs = await getRigs();
    return reply.type("text/html").send(page(`Bead: ${req.params.id}`, `<h1 class="text-3xl font-bold">Bead ${req.params.id}</h1><p class="mt-2 text-base-content/70">Bead detail — coming soon.</p>`, rigs, ""));
  });

  app.get<{ Params: { name: string } }>("/agent/:name", async (req, reply) => {
    const rigs = await getRigs();
    return reply.type("text/html").send(page(`Agent: ${req.params.name}`, `<h1 class="text-3xl font-bold">Agent ${req.params.name}</h1><p class="mt-2 text-base-content/70">Agent detail — coming soon.</p>`, rigs, ""));
  });

  app.get("/tour", async (_req, reply) => {
    const rigs = await getRigs();
    return reply.type("text/html").send(page("Tour", `<h1 class="text-3xl font-bold">Tour</h1><p class="mt-2 text-base-content/70">Guided tour — coming soon.</p>`, rigs, "/tour"));
  });
}
