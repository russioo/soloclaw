"use client";

import { useState, useEffect } from "react";
import type { AgentState } from "@/lib/agent-types";

const POLL_MS = 10_000;

export function useAgentData(): AgentState {
  const [state, setState] = useState<AgentState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/trigger-agent").catch(() => {});

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/agent-stats");
        if (!res.ok) {
          const err = await res.json().catch(async () => ({ error: await res.text() }));
          throw new Error(err.error || "Error");
        }
        const data = await res.json();
        setState(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not fetch data");
      }
    };

    fetchStats();
    const iv = setInterval(fetchStats, POLL_MS);
    return () => clearInterval(iv);
  }, []);

  const empty: AgentState = {
    thought: error ? `Error: ${error}` : "Waiting for fees.",
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

  return state ?? empty;
}
