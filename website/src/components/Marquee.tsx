"use client";

import { useAgentData } from "@/hooks/useAgentData";

export default function Marquee() {
  const { feedEntries } = useAgentData();
  const items = feedEntries.map((e) => e.action);
  const repeated = items.length > 0 ? [...items, ...items, ...items, ...items] : ["Waiting for activity"];

  return (
    <div className="marquee">
      <div className="marquee-track">
        {repeated.map((item, i) => (
          <span className="marquee-item" key={i}>
            <span className="marquee-dot" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
