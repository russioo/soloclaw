/**
 * HTTP server – eksponerer /run så Vercel kan kalde agenten på din PC.
 * Kræver ngrok (eller lignende) for at Vercel kan nå din lokale maskine.
 */

import "dotenv/config";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { runCycle } from "./run.js";

const PORT = parseInt(process.env.AGENT_PORT ?? "3456", 10);

let cycleRunning = false;

async function handleRun(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  if (cycleRunning) {
    res.writeHead(503);
    res.end(JSON.stringify({ ok: false, error: "Cycle already running" }));
    return;
  }
  cycleRunning = true;
  try {
    const result = await runCycle();
    res.writeHead(200);
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error("[Server] /run fejl:", err);
    const msg = err instanceof Error ? err.message : "Fejl";
    res.writeHead(500);
    res.end(JSON.stringify({ ok: false, error: msg }));
  } finally {
    cycleRunning = false;
  }
}

const server = createServer((req, res) => {
  if (req.url === "/run" || req.url === "/api/run") {
    handleRun(req, res);
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Ikke fundet – brug /run eller /api/run" }));
  }
});

server.listen(PORT, () => {
  console.log(`Agent server på http://localhost:${PORT}`);
  console.log(`Endpoints: GET/POST http://localhost:${PORT}/run`);
  console.log(`Kør ngrok: npx ngrok http ${PORT}`);
});
