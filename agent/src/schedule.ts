/**
 * Kører agenten hver 3 min (eller CYCLE_INTERVAL_MS).
 */
import { config } from "./config.js";
import { runCycle } from "./run.js";

async function main() {
  console.log(`Starter agent (interval: ${config.cycleIntervalMs}ms)...`);
  const tick = async () => {
    try {
      await runCycle();
    } catch (err) {
      console.error("[Schedule] Fejl:", err);
    }
  };
  await tick();
  setInterval(tick, config.cycleIntervalMs);
}

main();
