export const metadata = {
  title: "Roadmap — SoloClaw",
  description: "What we've built, what's next, and where SoloClaw is heading.",
};

const phases: Phase[] = [
  {
    id: "01",
    title: "Foundation",
    status: "completed",
    description: "The core autonomous agent — live on Solana, running 24/7.",
    items: [
      { label: "Autonomous buyback & burn engine", done: true },
      { label: "On-chain proof of work (verified TXs)", done: true },
      { label: "Real-time dashboard with live stats", done: true },
      { label: "AI-powered agent thoughts", done: true },
      { label: "Technical documentation", done: true },
    ],
  },
  {
    id: "02",
    title: "Agent Mind",
    status: "active",
    description: "Go deeper into the agent's reasoning. Full transparency into every decision.",
    items: [
      { label: "Deep thought explorer — full reasoning history", done: false },
      { label: "Decision timeline with before/after state", done: false },
      { label: "Agent personality & strategy profile", done: false },
      { label: "Advanced analytics & cycle breakdowns", done: false },
    ],
  },
  {
    id: "03",
    title: "Launch Platform",
    status: "upcoming",
    description: "Let anyone deploy their own token with a real autonomous agent behind it.",
    items: [
      { label: "One-click agent + token deployment", done: false },
      { label: "Custom agent strategies & personalities", done: false },
      { label: "Agent configuration dashboard", done: false },
      { label: "Shared infrastructure — no servers needed", done: false },
    ],
  },
  {
    id: "04",
    title: "Ecosystem",
    status: "upcoming",
    description: "A network of autonomous agents, interacting and evolving.",
    items: [
      { label: "Agent-to-agent communication layer", done: false },
      { label: "Community-driven strategy marketplace", done: false },
      { label: "Multi-chain expansion", done: false },
      { label: "Open-source agent SDK", done: false },
    ],
  },
];

interface Phase {
  id: string;
  title: string;
  status: "completed" | "active" | "upcoming";
  description: string;
  items: { label: string; done: boolean }[];
}

function PhaseCard({ phase, isLast }: { phase: Phase; isLast: boolean }) {
  const statusLabel =
    phase.status === "completed" ? "Done" :
    phase.status === "active" ? "In progress" : "Upcoming";

  return (
    <div className={`rm-phase rm-phase--${phase.status}`}>
      <div className="rm-phase-rail">
        <div className="rm-phase-node">
          {phase.status === "completed" ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : phase.status === "active" ? (
            <span className="rm-phase-pulse" />
          ) : (
            <span className="rm-phase-dot" />
          )}
        </div>
        {!isLast && <div className="rm-phase-line" />}
      </div>

      <div className="rm-phase-content">
        <div className="rm-phase-header">
          <span className="rm-phase-id">Phase {phase.id}</span>
          <span className={`rm-phase-badge rm-phase-badge--${phase.status}`}>
            {statusLabel}
          </span>
        </div>
        <h2 className="rm-phase-title">{phase.title}</h2>
        <p className="rm-phase-desc">{phase.description}</p>
        <ul className="rm-phase-items">
          {phase.items.map((item, i) => (
            <li key={i} className={`rm-item ${item.done ? "rm-item--done" : ""}`}>
              <span className="rm-item-icon">
                {item.done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span className="rm-item-circle" />
                )}
              </span>
              <span className="rm-item-label">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const completedCount = phases.filter(p => p.status === "completed").length;
  const progress = Math.round((completedCount / phases.length) * 100);

  return (
    <div className="rm">
      <div className="rm-hero">
        <span className="rm-label">Roadmap</span>
        <h1 className="rm-headline">
          Building the future<br/>of autonomous tokens
        </h1>
        <p className="rm-sub">
          Every phase is a step toward a world where tokens run themselves.
          Here&apos;s what we&apos;ve shipped and what&apos;s coming.
        </p>
        <div className="rm-progress">
          <div className="rm-progress-bar">
            <div className="rm-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="rm-progress-text">{progress}% complete — Phase {completedCount + 1} of {phases.length}</span>
        </div>
      </div>

      <div className="rm-timeline">
        {phases.map((phase, i) => (
          <PhaseCard key={phase.id} phase={phase} isLast={i === phases.length - 1} />
        ))}
      </div>
    </div>
  );
}
