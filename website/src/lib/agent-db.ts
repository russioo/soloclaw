import { supabaseAdmin } from "./supabase";

export async function saveAgentCycle(result: {
  claimed?: number;
  creatorShare?: number;
  boughtBackSol?: number;
  burnedTokens?: number;
  lpSol?: number;
  treasurySol?: number;
  thought?: string;
}) {
  const admin = supabaseAdmin;
  if (!admin) return;

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

  const updates = {
    total_claimed: (prev.total_claimed ?? 0) + (result.claimed ?? 0),
    total_creator_share: (prev.total_creator_share ?? 0) + (result.creatorShare ?? 0),
    total_burned: (prev.total_burned ?? 0) + (result.burnedTokens ?? 0),
    total_bought_back: (prev.total_bought_back ?? 0) + (result.burnedTokens ?? 0),
    total_lp_sol: (prev.total_lp_sol ?? 0) + (result.lpSol ?? 0),
    treasury_sol: result.treasurySol ?? prev.treasury_sol ?? 0,
    thought: result.thought ?? prev.thought ?? "Waiting for next cycle",
    thought_meta: prev.thought_meta ?? "— SoloClaw",
    feed_entries: prev.feed_entries ?? [],
    updated_at: new Date().toISOString(),
  };

  await admin.from("agent_stats").upsert(
    { id: "default", ...updates },
    { onConflict: "id" }
  );
}

export async function getAgentStats() {
  const { supabase } = await import("./supabase");
  if (!supabase) return null;

  const { data } = await supabase.from("agent_stats").select("*").eq("id", "default").single();
  return data;
}
