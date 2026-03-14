import Fastify from "fastify";
import { registerRoutes } from "./routes.js";

const PORT = 8081;

export async function buildApp() {
  const app = Fastify({ logger: false });
  await registerRoutes(app);
  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: "127.0.0.1" });
  console.log(`Dashboard V2 listening on http://127.0.0.1:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
