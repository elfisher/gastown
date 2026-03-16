import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import formbody from "@fastify/formbody";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { registerRoutes } from "./routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(formbody);
  await app.register(fastifyStatic, {
    root: join(__dirname, "..", "static"),
    prefix: "/static/",
  });

  await registerRoutes(app);

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  console.log(`Gas Town Dashboard v2 listening on http://localhost:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
