"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Kører agenten hver 3 min (eller CYCLE_INTERVAL_MS).
 */
require("dotenv/config");
const config_js_1 = require("./config.js");
const run_js_1 = require("./run.js");
async function main() {
    console.log(`Starter agent (interval: ${config_js_1.config.cycleIntervalMs}ms)...`);
    const tick = async () => {
        try {
            await (0, run_js_1.runCycle)();
        }
        catch (err) {
            console.error("[Schedule] Fejl:", err);
        }
    };
    await tick();
    setInterval(tick, config_js_1.config.cycleIntervalMs);
}
main();
