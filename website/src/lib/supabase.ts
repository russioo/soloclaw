import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

/** Til skrivning (agent) – bypasser RLS. Kun server-side. */
export const supabaseAdmin: SupabaseClient | null =
  url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

export type AgentStatsRow = {
  id: string;
  total_claimed: number;
  total_creator_share: number;
  total_burned: number;
  total_bought_back: number;
  total_lp_sol: number;
  treasury_sol: number;
  thought: string;
  thought_meta: string;
  feed_entries: unknown[];
  updated_at: string;
};
