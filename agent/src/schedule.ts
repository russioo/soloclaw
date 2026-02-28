/**
 * Kører agenten i loop (default hvert 60. sekund).
 * Brug: cd agent && npm run schedule
 */
import "dotenv/config";
import { config } from "./config.js";
import { runCycle } from "./run.js";
import { saveAgentCycle, getStats } from "./db.js";
import { generateThought } from "./thought.js";

async function tick() {
  try {
    const result = await runCycle();
    console.log("Resultat:", JSON.stringify(result));

    if (result.ok) {
      const isSkipped = "skipped" in result && result.skipped;
      const stats = await getStats();

      const thought = await generateThought({
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

      await saveAgentCycle({
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
  } catch (err) {
    console.error("[Schedule] Fejl:", err);
  }
}

async function main() {
  const intervalSec = Math.round(config.cycleIntervalMs / 1000);
  console.log(`Agent startet – kører hvert ${intervalSec}s (CYCLE_INTERVAL_MS=${config.cycleIntervalMs})`);

  await tick();
  setInterval(tick, config.cycleIntervalMs);
}

main();
