import { NextResponse } from "next/server";
import { getAgentStats } from "@/lib/agent-db";

/** Henter agent-data fra Supabase. Opdateres når du kører npm run buyback i agent/. */
export async function GET() {
  try {
    const db = await getAgentStats();
    const json = {
      thought: db?.thought ?? "Waiting for fees.",
      thoughtMeta: db?.thought_meta ?? "— SoloClaw",
      feedEntries: db?.feed_entries ?? [],
      stats: {
        treasurySol: db?.treasury_sol ?? 0,
        totalClaimed: db?.total_claimed ?? 0,
        totalCreatorShare: db?.total_creator_share ?? 0,
        totalBurned: db?.total_burned ?? 0,
        totalBoughtBack: db?.total_bought_back ?? 0,
        totalLpSol: db?.total_lp_sol ?? 0,
      },
    };
    return NextResponse.json(json, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[agent-stats]", err);
    return NextResponse.json(
      { error: "Could not fetch data" },
      { status: 500 }
    );
  }
}
