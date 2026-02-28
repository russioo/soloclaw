"use client";

import { useEffect, useState } from "react";
import type { AgentFeedEntry } from "@/lib/agent-types";

const TYPE_LABELS: Record<string, string> = {
  "Claimed fees": "Claim",
  "Buyback": "Buyback",
  "Burned tokens": "Burn",
  "Added LP": "LP",
  "Scanned": "Scan",
};

const TYPE_COLORS: Record<string, string> = {
  "Claim": "var(--mid)",
  "Buyback": "var(--accent)",
  "Burn": "var(--ink)",
  "LP": "#4A7C59",
  "Scan": "var(--dim)",
};

function shortenSig(sig: string): string {
  return sig.slice(0, 8) + "..." + sig.slice(-8);
}

export default function ProofPage() {
  const [entries, setEntries] = useState<AgentFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent-stats")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.feedEntries ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const actionEntries = entries.filter((e) => e.action !== "Thought");
  const txEntries = actionEntries.filter((e) => e.sig);
  const allEntries = actionEntries;

  return (
    <article className="proof-page">
      <h1 className="proof-title">Proof of Work</h1>
      <p className="proof-subtitle">
        Every transaction SoloClaw has ever executed — verified on Solana.
        <br />
        Click any signature to view it on Solscan.
      </p>

      <div className="proof-stats">
        <div className="proof-stat">
          <span className="proof-stat-num">{txEntries.length}</span>
          <span className="proof-stat-label">Verified TXs</span>
        </div>
        <div className="proof-stat">
          <span className="proof-stat-num">{allEntries.length}</span>
          <span className="proof-stat-label">Total Actions</span>
        </div>
      </div>

      {loading ? (
        <p className="proof-loading">Loading transactions...</p>
      ) : (
        <div className="proof-table">
          <div className="proof-row proof-header-row">
            <span className="proof-col-time">Time</span>
            <span className="proof-col-type">Type</span>
            <span className="proof-col-detail">Detail</span>
            <span className="proof-col-tx">Transaction</span>
          </div>
          {allEntries.map((entry, i) => {
            const label = TYPE_LABELS[entry.action] ?? entry.action;
            const color = TYPE_COLORS[label] ?? "var(--mid)";
            return (
              <div className="proof-row" key={i}>
                <span className="proof-col-time">{entry.time}</span>
                <span className="proof-col-type">
                  <span className="proof-badge" style={{ background: color }}>{label}</span>
                </span>
                <span className="proof-col-detail">{entry.detail}</span>
                <span className="proof-col-tx">
                  {entry.sig ? (
                    <a
                      href={`https://solscan.io/tx/${entry.sig}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="proof-sig"
                    >
                      {shortenSig(entry.sig)}
                    </a>
                  ) : (
                    <span className="proof-no-sig">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
