"use client";

import { useState, useEffect } from "react";
import { useFakeAgent } from "./useFakeAgent";
import type { AgentState } from "@/lib/agent-types";

const MODE = process.env.NEXT_PUBLIC_AGENT_MODE ?? "fake";
const POLL_INTERVAL_MS = 10_000;

export function useAgentData(): AgentState {
  const fake = useFakeAgent();

  const [realState, setRealState] = useState<AgentState | null>(null);
  const [realError, setRealError] = useState<string | null>(null);

  useEffect(() => {
    if (MODE !== "real") return;

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/agent-stats");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setRealState(data);
        setRealError(null);
      } catch (err) {
        setRealError(err instanceof Error ? err.message : "Kunne ikke hente data");
      }
    };

    fetchStats();
    const iv = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);

  if (MODE === "real") {
    if (realError) {
      return {
        thought: `Fejl: ${realError}`,
        thoughtMeta: "— SoloClaw",
        feedEntries: [],
        stats: {
          treasurySol: 0,
          totalClaimed: 0,
          totalCreatorShare: 0,
          totalBurned: 0,
          totalBoughtBack: 0,
          totalLpSol: 0,
        },
      };
    }
    if (realState) return realState;
    return {
      thought: "Henter ægte data...",
      thoughtMeta: "— SoloClaw",
      feedEntries: [],
      stats: {
        treasurySol: 0,
        totalClaimed: 0,
        totalCreatorShare: 0,
        totalBurned: 0,
        totalBoughtBack: 0,
        totalLpSol: 0,
      },
    };
  }

  return fake;
}
