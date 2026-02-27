"use client";

import { useState, useEffect } from "react";
import { getFakeAgentState, type AgentState } from "@/lib/fake-agent";
import { CYCLE_INTERVAL_MS } from "@/data/agent-script";

const STORAGE_KEY = "soloclaw_demo_start";

function getDemoStart(): number {
  if (typeof window === "undefined") return Date.now();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return parseInt(stored, 10);
  const now = Date.now();
  localStorage.setItem(STORAGE_KEY, String(now));
  return now;
}

function getCyclesCompleted(): number {
  const start = getDemoStart();
  const elapsed = Date.now() - start;
  return Math.floor(elapsed / CYCLE_INTERVAL_MS);
}

export function useFakeAgent(): AgentState {
  const [state, setState] = useState<AgentState>(() =>
    getFakeAgentState(getCyclesCompleted())
  );

  useEffect(() => {
    const tick = () => setState(getFakeAgentState(getCyclesCompleted()));
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, []);

  return state;
}
