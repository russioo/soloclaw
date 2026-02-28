"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Kører agenten i loop (default hvert 60. sekund).
 * Brug: cd agent && npm run schedule
 */
require("dotenv/config");
const config_js_1 = require("./config.js");
const run_js_1 = require("./run.js");
const db_js_1 = require("./db.js");
const thought_js_1 = require("./thought.js");
async function tick() {
    try {
        const result = await (0, run_js_1.runCycle)();
        console.log("Resultat:", JSON.stringify(result));
        if (result.ok) {
            const isSkipped = "skipped" in result && result.skipped;
            const stats = await (0, db_js_1.getStats)();
            const thought = await (0, thought_js_1.generateThought)({
                claimed: "claimed" in result ? result.claimed : undefined,
                boughtBackSol: "boughtBackSol" in result ? result.boughtBackSol : undefined,
                burnedTokens: "burnedTokens" in result ? result.burnedTokens : undefined,
                lpSol: "lpSol" in result ? result.lpSol : undefined,
                treasurySol: result.treasurySol,
                skipped: isSkipped,
                totalClaimed: stats?.total_claimed ?? 0,
                totalBurned: stats?.total_burned ?? 0,
                totalBoughtBack: stats?.total_bought_back ?? 0,
            });
            console.log(`[thought] "${thought}"`);
            await (0, db_js_1.saveAgentCycle)({
                claimed: "claimed" in result ? result.claimed : undefined,
                creatorShare: "creatorShare" in result ? result.creatorShare : undefined,
                boughtBackSol: "boughtBackSol" in result ? result.boughtBackSol : undefined,
                burnedTokens: "burnedTokens" in result ? result.burnedTokens : undefined,
                lpSol: "lpSol" in result ? result.lpSol : undefined,
                treasurySol: result.treasurySol,
                skipped: isSkipped,
                thought,
            });
        }
    }
    catch (err) {
        console.error("[Schedule] Fejl:", err);
    }
}
async function main() {
    const intervalSec = Math.round(config_js_1.config.cycleIntervalMs / 1000);
    console.log(`Agent startet – kører hvert ${intervalSec}s (CYCLE_INTERVAL_MS=${config_js_1.config.cycleIntervalMs})`);
    await tick();
    setInterval(tick, config_js_1.config.cycleIntervalMs);
}
main();
