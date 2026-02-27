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
    return NextResponse.json({ triggered: false, reason: "Ran less than 2 min ago" }, { status: 200 });
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
      let res: Response;
      let text: string;
      try {
        res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(55_000) });
        text = await res.text();
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        return NextResponse.json({
          triggered: false,
          reason: msg.includes("timeout") ? "Backend timeout (60s)" : `Backend unreachable: ${msg.slice(0, 80)}`,
        }, { status: 200 });
      }

      if (!res.ok) {
        if (res.status === 404 || res.status === 502 || text.includes("ngrok") || text.includes("ERR_NGROK")) {
          return NextResponse.json({
            triggered: false,
            reason: "Agent backend offline – start ngrok og sæt AGENT_BACKEND_URL i Vercel",
          }, { status: 200 });
        }
        if (res.status === 503 && text.includes("Cycle already running")) {
          return NextResponse.json({ triggered: false, reason: "Cycle already running" }, { status: 200 });
        }
        if (res.status === 500) {
          return NextResponse.json({ triggered: false, reason: `Backend error: ${text.slice(0, 150)}` }, { status: 200 });
        }
        return NextResponse.json({ triggered: false, reason: `Backend ${res.status}: ${text.slice(0, 150)}` }, { status: 200 });
      }

      try {
        result = JSON.parse(text) as Awaited<ReturnType<typeof runAgentCycle>>;
      } catch {
        return NextResponse.json({ triggered: false, reason: "Invalid JSON from backend" }, { status: 200 });
      }
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
        thought: `Claimed ${result.claimed?.toFixed(2)} SOL`,
      });
    }

    return NextResponse.json({ triggered: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[trigger-agent]", err);
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ triggered: false, reason: msg }, { status: 200 });
  }
}
