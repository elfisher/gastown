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

  // Serve xterm.js vendor assets from node_modules
  await app.register(fastifyStatic, {
    root: join(__dirname, "..", "node_modules", "@xterm"),
    prefix: "/vendor/xterm/",
    decorateReply: false,
  });

  await registerRoutes(app);

  return app;
}

// Only start server when run directly (not imported by tests)
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("/server.ts") ||
    process.argv[1].endsWith("/server.js"));

if (isMainModule) {
  buildApp()
    .then(async (app) => {
      await app.listen({ port: config.port, host: config.host });
      console.log(
        `Gas Town Dashboard v2 listening on http://localhost:${config.port}`
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
