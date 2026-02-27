#!/usr/bin/env node
/** Reset agent_stats i Supabase til rene værdier */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local"), override: true });

const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) { console.error("Mangler SUPABASE env vars"); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { error } = await sb.from("agent_stats").upsert({
    id: "default",
    total_claimed: 0,
    total_creator_share: 0,
    total_burned: 0,
    total_bought_back: 0,
    total_lp_sol: 0,
    treasury_sol: 0,
    thought: "Agent online — scanning for fees.",
    thought_meta: "— SoloClaw",
    feed_entries: [],
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (error) { console.error("Fejl:", error); process.exit(1); }
  console.log("DB reset til 0. Agenten akkumulerer fra nu af.");
}

main();
