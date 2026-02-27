"use client";
import { useRef, useEffect, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { useAgentData } from "@/hooks/useAgentData";
import { formatCompact } from "@/lib/format-stats";

const MOBILE_BREAKPOINT = 768;

export default function Spread4() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(true);
  const { stats } = useAgentData();

  const panels = [
    { val: String(stats.totalClaimed), tag: "To treasury", sub: "20% af claimed fees til treasury", accent: false },
    { val: formatCompact(stats.totalBurned), tag: "Tokens burned", sub: "Permanently removed from circulating supply", accent: true },
    { val: formatCompact(stats.totalBoughtBack), tag: "Bought back", sub: "Tokens repurchased using treasury funds", accent: false },
    { val: String(stats.totalLpSol), tag: "SOL in LP", sub: "Added to the Pump.fun liquidity pool", accent: false },
  ];

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, []);

  useGSAP(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;

    if (isMobile) {
      gsap.set(track, { x: 0 });
      return;
    }

    const totalScroll = Math.max(0, track.scrollWidth - window.innerWidth);
    if (totalScroll <= 0) return;

    gsap.to(track, {
      x: -totalScroll,
      ease: "none",
      scrollTrigger: {
        trigger: wrap,
        start: "top top",
        end: () => `+=${totalScroll}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });
  }, { scope: wrapRef, dependencies: [isMobile] });

  return (
    <div className="s4-wrap" ref={wrapRef}>
      <div className="s4" ref={trackRef}>
        {panels.map((p, i) => (
          <div className="s4-panel" key={i}>
            <div className={`s4-panel-val${p.accent ? " s4-panel-val-accent" : ""}`}>
              {p.val}
            </div>
            <div className="s4-panel-tag">{p.tag}</div>
            <div className="s4-panel-sub">{p.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
