import { NextResponse } from "next/server";
import { fetchPumpStats } from "@/lib/pump-data";
import { getFakeAgentState } from "@/lib/fake-agent";
import { CYCLE_INTERVAL_MS } from "@/data/agent-script";

function getCyclesCompleted(): number {
  return Math.floor(Date.now() / CYCLE_INTERVAL_MS) % 60;
}

export async function GET(request: Request) {
  const mode = process.env.NEXT_PUBLIC_AGENT_MODE ?? "fake";
  const { searchParams } = new URL(request.url);
  const forceMode = searchParams.get("mode");

  const useReal = (forceMode ?? mode) === "real";
  const creator = process.env.NEXT_PUBLIC_CREATOR_ADDRESS;
  const mint = process.env.NEXT_PUBLIC_MINT_ADDRESS;
  const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com";

  if (useReal) {
    if (!creator) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_CREATOR_ADDRESS required for real mode" },
        { status: 400 }
      );
    }

    try {
      const chainStats = await fetchPumpStats({
        rpcUrl: rpc,
        creatorAddress: creator,
        mintAddress: mint,
      });

      const statsUrl = process.env.AGENT_STATS_API_URL;
      let stored: Partial<{ stats: Record<string, number>; thought: string; thoughtMeta: string; feedEntries: unknown[] }> = {};
      if (statsUrl) {
        try {
          const res = await fetch(statsUrl, { next: { revalidate: 30 } });
          if (res.ok) stored = await res.json();
        } catch {
          /* ignorer */
        }
      }

      const s = stored.stats ?? {};
      const stats = {
        treasurySol: chainStats.treasurySol ?? (s.treasurySol as number) ?? 0,
        totalClaimed: (s.totalClaimed as number) ?? chainStats.totalClaimed ?? 0,
        totalCreatorShare: (s.totalCreatorShare as number) ?? chainStats.totalCreatorShare ?? 0,
        totalBurned: (s.totalBurned as number) ?? chainStats.totalBurned ?? 0,
        totalBoughtBack: (s.totalBoughtBack as number) ?? chainStats.totalBoughtBack ?? 0,
        totalLpSol: (s.totalLpSol as number) ?? chainStats.totalLpSol ?? 0,
      };

      return NextResponse.json({
        thought: stored.thought ?? "Venter på agent data...",
        thoughtMeta: stored.thoughtMeta ?? "— SoloClaw",
        feedEntries: stored.feedEntries ?? [],
        stats,
      });
    } catch (err) {
      console.error("[api/agent-stats] real fetch error:", err);
      return NextResponse.json(
        { error: "Kunne ikke hente Pump.fun data" },
        { status: 500 }
      );
    }
  }

  const cycles = getCyclesCompleted();
  const state = getFakeAgentState(cycles);

  return NextResponse.json(state);
}
