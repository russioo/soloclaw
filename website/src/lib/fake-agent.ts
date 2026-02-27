/**
 * Fake agent – kører script-cykluser. Hver cyklus: claim → 80% ud → 20% treasury → buyback/burn/LP.
 * Viser KUN treasury-data (20%). 80% vises aldrig.
 */

import { runCycle, CYCLE_INTERVAL_MS, MIGRATED_AFTER_CYCLE, type CycleAction } from "@/data/agent-script";
import type { AgentFeedEntry, AgentStats, AgentState } from "./agent-types";

export type { AgentFeedEntry, AgentStats, AgentState };

function actionToFeedEntry(action: CycleAction, cycleIndex: number): AgentFeedEntry | null {
  const time = `C${cycleIndex + 1}`;
  switch (action.type) {
    case "claim":
      return {
        time,
        action: `+${action.toTreasury.toFixed(2)} SOL to treasury`,
        detail: "20% from claim",
      };
    case "buyback":
      return {
        time,
        action: `Bought back ${action.tokens.toLocaleString()} tokens`,
        detail: `${action.sol.toFixed(2)} SOL`,
      };
    case "burn":
      return {
        time,
        action: `Burned ${action.tokens.toLocaleString()} tokens`,
        detail: "Supply reduced",
      };
    case "addLP":
      return {
        time,
        action: `Added ${action.sol.toFixed(2)} SOL to LP`,
        detail: "Pool depth strengthened",
      };
    default:
      return null;
  }
}

export function getFakeAgentState(cyclesCompleted: number): AgentState {
  let treasury = 0;
  let totalToTreasury = 0;
  let totalBurned = 0;
  let totalBoughtBack = 0;
  let totalLpSol = 0;

  const feedEntries: AgentFeedEntry[] = [];
  let latestThought = "Waiting for first cycle...";

  for (let i = 0; i < cyclesCompleted; i++) {
    const isMigrated = i >= MIGRATED_AFTER_CYCLE;
    const { actions, thought } = runCycle(i, isMigrated);
    latestThought = thought;

    for (const action of actions) {
      const entry = actionToFeedEntry(action, i);
      if (entry) feedEntries.push(entry);

      switch (action.type) {
        case "claim":
          treasury += action.toTreasury;
          totalToTreasury += action.toTreasury;
          break;
        case "buyback":
          treasury -= action.sol;
          totalBoughtBack += action.tokens;
          break;
        case "burn":
          totalBurned += action.tokens;
          break;
        case "addLP":
          treasury -= action.sol;
          totalLpSol += action.sol;
          break;
      }
    }
  }

  const stats: AgentStats = {
    treasurySol: Math.round(Math.max(0, treasury) * 10) / 10,
    totalClaimed: Math.round(totalToTreasury * 10) / 10,
    totalCreatorShare: 0,
    totalBurned,
    totalBoughtBack,
    totalLpSol: Math.round(totalLpSol * 10) / 10,
  };

  const thoughtMeta =
    cyclesCompleted > 0
      ? `— SoloClaw, cycle ${cyclesCompleted}`
      : "— SoloClaw";

  return {
    thought: latestThought,
    thoughtMeta,
    feedEntries,
    stats,
  };
}
