/**
 * HTTP server – eksponerer /run så Vercel kan kalde agenten på din PC.
 * Kræver ngrok (eller lignende) for at Vercel kan nå din lokale maskine.
 */

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
  const path = req.url?.split("?")[0] ?? "";
  if (path === "/health" || path === "/ping") {
    res.writeHead(200);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
    return;
  }
  if (path === "/run" || path === "/api/run") {
    handleRun(req, res);
    return;
  }
  res.writeHead(404);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Ikke fundet – brug /run, /api/run eller /health" }));
});

server.listen(PORT, () => {
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "";
  const rpcLabel = rpc.includes("quiknode") ? "QuickNode" : rpc ? "Custom RPC" : "IKKE SAT";
  console.log(`[Agent] Server på http://localhost:${PORT}`);
  console.log(`[Agent] RPC: ${rpcLabel}`);
  console.log(`[Agent] /health = status  /run = kør cyklus`);
  console.log(`[Agent] Kør i anden terminal: npx ngrok http ${PORT}`);
  console.log(`[Agent] Sæt ngrok URL i Vercel: AGENT_BACKEND_URL`);
});
