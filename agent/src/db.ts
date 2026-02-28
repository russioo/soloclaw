/**
 * Gemmer agent-cyklus til Supabase. Hjemmesiden læser herfra.
 */

import { createClient } from "@supabase/supabase-js";

const TOKEN_DECIMALS = 6; // pump.fun default

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

type FeedEntry = { time: string; action: string; detail: string; sig?: string; strategy?: string };

export async function getStats() {
  const admin = getSupabase();
  if (!admin) return null;
  const { data } = await admin.from("agent_stats").select("*").eq("id", "default").single();
  return data;
}

export async function saveAgentCycle(result: {
  claimed?: number;
  creatorShare?: number;
  boughtBackSol?: number;
  burnedTokens?: number;
  lpSol?: number;
  treasurySol?: number;
  thought?: string;
  skipped?: boolean;
  strategy?: string;
  txs?: { sig: string; type: string; time: string }[];
}) {
  const admin = getSupabase();
  if (!admin) {
    console.warn("[db] Supabase ikke konfigureret – sæt NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY i .env");
    return;
  }

  const { data: row } = await admin.from("agent_stats").select("*").eq("id", "default").single();

  const prev = row ?? {
    total_claimed: 0,
    total_creator_share: 0,
    total_burned: 0,
    total_bought_back: 0,
    total_lp_sol: 0,
    treasury_sol: 0,
    thought: "",
    thought_meta: "— SoloClaw",
    feed_entries: [],
  };

  const burnedHuman = (result.burnedTokens ?? 0) / Math.pow(10, TOKEN_DECIMALS);

  // Build a sig lookup: type → signature
  const sigMap = new Map<string, string>();
  for (const tx of result.txs ?? []) {
    sigMap.set(tx.type, tx.sig);
  }

  const prevFeed: FeedEntry[] = Array.isArray(prev.feed_entries) ? prev.feed_entries : [];
  const newEntries: FeedEntry[] = [];
  const now = new Date();
  const timeStr = `${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")} UTC`;

  if (result.skipped) {
    newEntries.push({ time: timeStr, action: "Scanned", detail: `Vault has ${(result.treasurySol ?? 0).toFixed(4)} SOL — waiting for more fees` });
  } else {
    if (result.claimed && result.claimed > 0) {
      newEntries.push({ time: timeStr, action: "Claimed fees", detail: `${result.claimed.toFixed(4)} SOL from creator vault`, sig: sigMap.get("claim") });
    }
    if (result.boughtBackSol && result.boughtBackSol > 0) {
      newEntries.push({ time: timeStr, action: "Buyback", detail: `Spent ${result.boughtBackSol.toFixed(4)} SOL`, sig: sigMap.get("buyback") });
    }
    if (burnedHuman > 0) {
      newEntries.push({ time: timeStr, action: "Burned tokens", detail: `${burnedHuman.toLocaleString("en-US", { maximumFractionDigits: 0 })} tokens removed from supply`, sig: sigMap.get("burn") });
    }
    if (result.lpSol && result.lpSol > 0) {
      newEntries.push({ time: timeStr, action: "Added LP", detail: `${result.lpSol.toFixed(4)} SOL to liquidity pool`, sig: sigMap.get("lp-deposit") || sigMap.get("lp-buy") });
    }
  }

  if (result.thought) {
    newEntries.push({
      time: timeStr,
      action: "Thought",
      detail: result.thought,
      strategy: result.strategy,
    });
  }

  const feed = [...newEntries, ...prevFeed].slice(0, 200);

  const updates = {
    total_claimed: (prev.total_claimed ?? 0) + (result.claimed ?? 0),
    total_creator_share: (prev.total_creator_share ?? 0) + (result.creatorShare ?? 0),
    total_burned: (prev.total_burned ?? 0) + burnedHuman,
    total_bought_back: (prev.total_bought_back ?? 0) + (result.boughtBackSol ?? 0),
    total_lp_sol: (prev.total_lp_sol ?? 0) + (result.lpSol ?? 0),
    treasury_sol: result.treasurySol ?? prev.treasury_sol ?? 0,
    thought: result.thought ?? prev.thought ?? "Waiting for next cycle",
    thought_meta: prev.thought_meta ?? "— SoloClaw",
    feed_entries: feed,
    updated_at: new Date().toISOString(),
  };

  await admin.from("agent_stats").upsert(
    { id: "default", ...updates },
    { onConflict: "id" }
  );
  console.log("[db] Gemt til Supabase");
}
