import type { FastifyInstance } from "fastify";
import { getMayorMessages, nudgeMayor, addSentMessage } from "../data/mayor.js";
import { renderMessages } from "../pages/mayor.js";

export async function registerMayorApi(app: FastifyInstance): Promise<void> {
  app.get("/api/mayor/messages", async (_req, reply) => {
    const messages = await getMayorMessages();
    return reply.type("text/html").send(renderMessages(messages));
  });

  app.post<{ Body: { message?: string } }>(
    "/api/mayor/nudge",
    async (req, reply) => {
      const message =
        typeof req.body === "object" && req.body !== null
          ? (req.body as Record<string, unknown>)["message"]
          : undefined;
      if (typeof message !== "string" || message.trim() === "") {
        return reply.status(400).send({ error: "message is required" });
      }
      const trimmed = message.trim();
      addSentMessage(trimmed);
      await nudgeMayor(trimmed);
      return reply
        .status(200)
        .header("HX-Trigger", "mayor-sent")
        .send({ ok: true });
    }
  );
}
