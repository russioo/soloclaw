import { NextResponse } from "next/server";
import { runAgentCycle } from "@/lib/agent-cycle";
import { saveAgentCycle } from "@/lib/agent-db";
import { fetchPumpStats } from "@/lib/pump-data";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.AGENT_PRIVATE_KEY || !process.env.CREATOR_WALLET) {
    return NextResponse.json(
      { error: "AGENT_PRIVATE_KEY and CREATOR_WALLET must be set in Vercel" },
      { status: 500 }
    );
  }

  try {
    const result = await runAgentCycle();

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

    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/agent]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent error" },
      { status: 500 }
    );
  }
}
