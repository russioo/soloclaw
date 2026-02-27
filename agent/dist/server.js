"use strict";
/**
 * Backend: HTTP server med /run – kører kun når du trigger (manuel eller via visit).
 * Ingen automatisk schedule – du siger til når der skal køres.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const run_js_1 = require("./run.js");
const PORT = parseInt(process.env.AGENT_PORT ?? "3456", 10);
let cycleRunning = false;
async function handleRun(_req, res) {
    res.setHeader("Content-Type", "application/json");
    if (cycleRunning) {
        res.writeHead(503);
        res.end(JSON.stringify({ ok: false, error: "Cycle already running" }));
        return;
    }
    cycleRunning = true;
    try {
        const result = await (0, run_js_1.runCycle)();
        res.writeHead(200);
        res.end(JSON.stringify(result));
    }
    catch (err) {
        console.error("[Server] /run fejl:", err);
        const msg = err instanceof Error ? err.message : "Fejl";
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: msg }));
    }
    finally {
        cycleRunning = false;
    }
}
const server = (0, http_1.createServer)((req, res) => {
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
    console.log(`[Agent] /health = status  /run = kør cyklus (on-demand)`);
    console.log(`[Agent] Trigger: fortæl mig "kør agenten" eller besøg sitet (hvis ngrok)`);
});
