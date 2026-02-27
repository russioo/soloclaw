#!/usr/bin/env node
/**
 * Buyback + burn – kør manuelt. Gemmer til Supabase. Hjemmesiden læser derfra.
 * Brug: cd agent && npm run buyback
 * Eller: fortæl Cursor "lav en buyback og burn"
 */

const path = require("path");

// Load .env fra agent/
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local"), override: true });

const { runCycle } = require("../dist/run.js");
const { saveAgentCycle } = require("../dist/db.js");

async function main() {
  const result = await runCycle();
  console.log("Resultat:", result);

  if (result.ok) {
    await saveAgentCycle({
      claimed: "claimed" in result ? result.claimed : undefined,
      creatorShare: "creatorShare" in result ? result.creatorShare : undefined,
      boughtBackSol: "boughtBackSol" in result ? result.boughtBackSol : undefined,
      burnedTokens: "burnedTokens" in result ? result.burnedTokens : undefined,
      lpSol: "lpSol" in result ? result.lpSol : undefined,
      treasurySol: result.treasurySol,
      thought: result.skipped
        ? "Waiting for enough fees"
        : `Claimed ${result.claimed?.toFixed(2) ?? "0"} SOL`,
    });
  }
}

main().catch((err) => {
  console.error("Fejl:", err);
  process.exit(1);
});
