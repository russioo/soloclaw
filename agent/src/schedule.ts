/**
 * Kører agenten i loop (default hvert 60. sekund).
 * Brug: cd agent && npm run schedule
 */
import "dotenv/config";
import { config } from "./config.js";
import { runCycle } from "./run.js";
import { saveAgentCycle } from "./db.js";

async function tick() {
  try {
    const result = await runCycle();
    console.log("Resultat:", JSON.stringify(result));

    if (result.ok) {
      const isSkipped = "skipped" in result && result.skipped;
      await saveAgentCycle({
        claimed: "claimed" in result ? result.claimed : undefined,
        creatorShare: "creatorShare" in result ? result.creatorShare : undefined,
        boughtBackSol: "boughtBackSol" in result ? result.boughtBackSol : undefined,
        burnedTokens: "burnedTokens" in result ? result.burnedTokens : undefined,
        lpSol: "lpSol" in result ? result.lpSol : undefined,
        treasurySol: result.treasurySol,
        skipped: isSkipped,
        thought: isSkipped
          ? "Scanning for fees…"
          : `Claimed ${("claimed" in result ? result.claimed : 0)?.toFixed(2) ?? "0"} SOL — bought back & burned`,
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
