import { NextResponse } from "next/server";
import { runAgentCycle } from "@/lib/agent-cycle";
import { saveAgentCycle } from "@/lib/agent-db";
import { fetchPumpStats } from "@/lib/pump-data";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

const MIN_INTERVAL_MS =
  process.env.NODE_ENV === "development"
    ? (parseInt(process.env.AGENT_DEV_INTERVAL_SEC ?? "10", 10) * 1000)
    : 2 * 60 * 1000; // 2 min prod

/** Kører agenten når nogen besøger sitet – max 1x per 2 min. Ingen cron nødvendig. */
export async function GET() {
  const agentBackendUrl = process.env.AGENT_BACKEND_URL?.trim();
  const useLocalAgent = !agentBackendUrl && process.env.AGENT_PRIVATE_KEY && process.env.CREATOR_WALLET;

  if (!agentBackendUrl && !useLocalAgent) {
    return NextResponse.json({ triggered: false, reason: "Missing config (AGENT_BACKEND_URL or AGENT_PRIVATE_KEY)" }, { status: 200 });
  }

  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json({ triggered: false, reason: "Supabase missing" }, { status: 200 });
  }

  const { data: row } = await admin.from("agent_stats").select("last_run_at").eq("id", "default").single();

  const lastRun = row?.last_run_at ? new Date(row.last_run_at).getTime() : 0;
  if (Date.now() - lastRun < MIN_INTERVAL_MS) {
    return NextResponse.json({ triggered: false, reason: "Ran less than 2 min ago" });
  }

  await admin.from("agent_stats").upsert(
    { id: "default", last_run_at: new Date().toISOString() },
    { onConflict: "id" }
  );

  try {
    let result: Awaited<ReturnType<typeof runAgentCycle>>;
    if (agentBackendUrl) {
      const base = agentBackendUrl.replace(/\/$/, "");
      const url = base.endsWith("/run") || base.endsWith("/api/run") ? base : `${base}/run`;
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(55_000) });
      if (!res.ok) throw new Error(`Backend ${res.status}: ${await res.text()}`);
      result = (await res.json()) as Awaited<ReturnType<typeof runAgentCycle>>;
    } else {
      result = await runAgentCycle();
    }

    let treasurySol: number | undefined;
    const creator = process.env.NEXT_PUBLIC_CREATOR_ADDRESS;
    const rpc = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com";
    if (creator) {
      try {
        const chain = await fetchPumpStats({ rpcUrl: rpc, creatorAddress: creator });
        treasurySol = chain.treasurySol;
      } catch {
        /* ignorer */
      }
    }

    if (result.skipped) {
      await saveAgentCycle({
        treasurySol: result.treasurySol ?? treasurySol,
        thought: "Waiting for enough fees",
      });
    } else if (result.ok && "claimed" in result) {
      await saveAgentCycle({
        claimed: result.claimed,
        creatorShare: result.creatorShare,
        boughtBackSol: result.boughtBackSol,
        burnedTokens: result.burnedTokens,
        lpSol: result.lpSol,
        treasurySol,
        thought: `Claimed ${result.claimed?.toFixed(4)} SOL`,
      });
    }

    return NextResponse.json({ triggered: true, ...result });
  } catch (err) {
    console.error("[trigger-agent]", err);
    return NextResponse.json(
      { triggered: true, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
