#!/usr/bin/env node
/**
 * Buyback + burn – kør manuelt. Gemmer til Supabase. Hjemmesiden læser derfra.
 * Brug: cd agent && npm run buyback
 */

const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local"), override: true });

const { runCycle } = require("../dist/run.js");
const { saveAgentCycle } = require("../dist/db.js");

async function main() {
  const result = await runCycle();
  console.log("Resultat:", result);

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
}

main().catch((err) => {
  console.error("Fejl:", err);
  process.exit(1);
});
