import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { insertDemoRequestSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/demo-requests", async (req, res) => {
    try {
      const data = insertDemoRequestSchema.parse(req.body);
      const created = await storage.createDemoRequest(data);
      res.json({ ok: true, id: created.id });
    } catch (err: any) {
      res.status(400).json({
        ok: false,
        error: err?.errors ?? err?.message ?? "Invalid request",
      });
    }
  });

  return httpServer;
}
