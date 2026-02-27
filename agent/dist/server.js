"use strict";
/**
 * HTTP server – eksponerer /run så Vercel kan kalde agenten på din PC.
 * Kræver ngrok (eller lignende) for at Vercel kan nå din lokale maskine.
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = require("http");
const run_js_1 = require("./run.js");
const PORT = parseInt(process.env.AGENT_PORT ?? "3456", 10);
async function handleRun(_req, res) {
    res.setHeader("Content-Type", "application/json");
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
}
const server = (0, http_1.createServer)((req, res) => {
    if (req.url === "/run" || req.url === "/api/run") {
        handleRun(req, res);
    }
    else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Ikke fundet – brug /run eller /api/run" }));
    }
});
server.listen(PORT, () => {
    console.log(`Agent server på http://localhost:${PORT}`);
    console.log(`Endpoints: GET/POST http://localhost:${PORT}/run`);
    console.log(`Kør ngrok: npx ngrok http ${PORT}`);
});
