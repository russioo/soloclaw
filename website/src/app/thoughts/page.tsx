"use client";

import { useAgentData } from "@/hooks/useAgentData";
import type { AgentFeedEntry } from "@/lib/agent-types";

const STRATEGY_LABELS: Record<string, { label: string; description: string }> = {
  "burn-heavy":    { label: "Burn Heavy",    description: "85% buyback + burn, 15% LP" },
  "balanced":      { label: "Balanced",      description: "50% buyback + burn, 50% LP" },
  "lp-focus":      { label: "LP Focus",      description: "15% buyback, 85% LP" },
  "full-burn":     { label: "Full Burn",     description: "100% buyback + burn" },
  "full-lp":       { label: "Full LP",       description: "100% liquidity" },
  "bonding-curve": { label: "Bonding Curve", description: "Pre-migration, 100% buyback" },
};

function ThoughtCard({ entry, index }: { entry: AgentFeedEntry; index: number }) {
  const strat = entry.strategy ? STRATEGY_LABELS[entry.strategy] : null;
  const isLatest = index === 0;

  return (
    <div className={`th-card ${isLatest ? "th-card--latest" : ""}`}>
      <div className="th-card-header">
        <span className="th-card-time">{entry.time}</span>
        {strat && (
          <span className={`th-card-strategy th-strat--${entry.strategy}`}>
            {strat.label}
          </span>
        )}
        {isLatest && <span className="th-card-live">Latest</span>}
      </div>
      <p className="th-card-text">{entry.detail}</p>
      {strat && (
        <span className="th-card-strat-desc">{strat.description}</span>
      )}
    </div>
  );
}

export default function ThoughtsPage() {
  const { feedEntries, thought, stats } = useAgentData();

  const thoughts = feedEntries.filter(
    (e: AgentFeedEntry) => e.action === "Thought"
  );

  const hasThoughts = thoughts.length > 0 || thought;

  return (
    <div className="th">
      <div className="th-hero">
        <span className="th-label">Agent Mind</span>
        <h1 className="th-headline">Inside the machine</h1>
        <p className="th-sub">
          Every 60 seconds, the agent observes, decides, and acts.
          Here&apos;s what it&apos;s thinking — unfiltered.
        </p>
      </div>

      <div className="th-current">
        <div className="th-current-label">
          <span className="th-current-dot" />
          Current thought
        </div>
        <blockquote className="th-current-quote">
          {thought || "Waiting for next cycle..."}
          <span className="th-cursor" />
        </blockquote>
      </div>

      <div className="th-stats-bar">
        <div className="th-stat">
          <span className="th-stat-val">{stats.totalClaimed.toFixed(2)}</span>
          <span className="th-stat-label">SOL claimed</span>
        </div>
        <div className="th-stat">
          <span className="th-stat-val">
          {stats.totalBurned >= 1_000_000
            ? `${(stats.totalBurned / 1_000_000).toFixed(1)}M`
            : stats.totalBurned >= 1_000
              ? `${(stats.totalBurned / 1_000).toFixed(1)}K`
              : stats.totalBurned.toFixed(0)}
        </span>
          <span className="th-stat-label">Tokens burned</span>
        </div>
        <div className="th-stat">
          <span className="th-stat-val">{stats.totalBoughtBack.toFixed(2)}</span>
          <span className="th-stat-label">SOL bought back</span>
        </div>
        <div className="th-stat">
          <span className="th-stat-val">{stats.totalLpSol.toFixed(2)}</span>
          <span className="th-stat-label">SOL in LP</span>
        </div>
      </div>

      <div className="th-history">
        <h2 className="th-history-title">Thought history</h2>
        {!hasThoughts ? (
          <p className="th-empty">
            No thoughts recorded yet. The agent will start logging its reasoning here
            once the next cycle completes.
          </p>
        ) : (
          <div className="th-list">
            {thoughts.map((entry: AgentFeedEntry, i: number) => (
              <ThoughtCard key={i} entry={entry} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
