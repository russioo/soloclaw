"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

const panels = [
  { val: "8.2", tag: "Fees claimed", sub: "Total SOL claimed from creator fees since launch", accent: false },
  { val: "420K", tag: "Tokens burned", sub: "Permanently removed from circulating supply", accent: true },
  { val: "1.2M", tag: "Bought back", sub: "Tokens repurchased using treasury funds", accent: false },
  { val: "3.6", tag: "SOL in LP", sub: "Added to the Pump.fun liquidity pool", accent: false },
];

export default function Spread4() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;

    const totalScroll = track.scrollWidth - window.innerWidth;

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
  }, { scope: wrapRef });

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
