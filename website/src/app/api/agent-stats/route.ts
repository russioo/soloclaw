import { NextResponse } from "next/server";
import { getAgentStats } from "@/lib/agent-db";
import { fetchPumpStats } from "@/lib/pump-data";

export async function GET() {
  const creator = process.env.NEXT_PUBLIC_CREATOR_ADDRESS;
  const mint = process.env.NEXT_PUBLIC_MINT_ADDRESS;
  const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com";

  try {
    const db = await getAgentStats();

    let treasurySol = db?.treasury_sol ?? 0;
    if (creator) {
      try {
        const chain = await fetchPumpStats({ rpcUrl: rpc, creatorAddress: creator, mintAddress: mint });
        treasurySol = chain.treasurySol ?? treasurySol;
      } catch {
        /* brug db */
      }
    }

    return NextResponse.json({
      thought: db?.thought ?? "Waiting for fees.",
      thoughtMeta: db?.thought_meta ?? "— SoloClaw",
      feedEntries: db?.feed_entries ?? [],
      stats: {
        treasurySol,
        totalClaimed: db?.total_claimed ?? 0,
        totalCreatorShare: db?.total_creator_share ?? 0,
        totalBurned: db?.total_burned ?? 0,
        totalBoughtBack: db?.total_bought_back ?? 0,
        totalLpSol: db?.total_lp_sol ?? 0,
      },
    });
  } catch (err) {
    console.error("[agent-stats]", err);
    return NextResponse.json(
      { error: "Could not fetch data" },
      { status: 500 }
    );
  }
}
