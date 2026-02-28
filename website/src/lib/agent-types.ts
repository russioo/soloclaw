/** Delt agent-state – bruges af både fake og real. */
export type AgentFeedEntry = {
  time: string;
  action: string;
  detail: string;
  sig?: string;
};

export type AgentStats = {
  treasurySol: number;
  totalClaimed: number;
  totalCreatorShare: number;
  totalBurned: number;
  totalBoughtBack: number;
  totalLpSol: number;
};

export type AgentState = {
  thought: string;
  thoughtMeta: string;
  feedEntries: AgentFeedEntry[];
  stats: AgentStats;
};
