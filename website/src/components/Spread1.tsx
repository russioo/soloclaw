"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import CloudBg from "./CloudBg";
import { useAgentData } from "@/hooks/useAgentData";
import { formatCompact, formatSol } from "@/lib/format-stats";

export default function Spread1() {
  const ref = useRef<HTMLElement>(null);
  const { stats } = useAgentData();

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.from(el.querySelector(".s1-mark"), {
      opacity: 0, y: -10, duration: 0.7, delay: 0.4,
    })
      .from(el.querySelector(".s1-headline"), {
        opacity: 0, y: 50, duration: 1.2,
      }, "-=0.3")
      .from(el.querySelector(".s1-sub"), {
        opacity: 0, y: 20, duration: 0.8,
      }, "-=0.5")
      .from(el.querySelectorAll(".s1-stat"), {
        opacity: 0, y: 20, stagger: 0.1, duration: 0.7,
      }, "-=0.4")
      .from(el.querySelector(".s1-cta"), {
        opacity: 0, y: 15, duration: 0.6,
      }, "-=0.3");
  }, { scope: ref });

  return (
    <section className="s1" ref={ref}>
      <CloudBg />
      <div className="s1-content">
        <div className="s1-mark">
          <span className="s1-dot" />
          <span>SoloClaw</span>
          <span className="s1-live">Live</span>
        </div>

        <h1 className="s1-headline">
          The token that<br />runs itself.
        </h1>

        <p className="s1-sub">
          SoloClaw is an autonomous agent that manages a Pump.fun token
          on Solana — no team, no multisig, no human decisions.
          It claims trading fees, executes buybacks, adds liquidity,
          and burns supply on its own.
        </p>

        <div className="s1-stats">
          <div className="s1-stat">
            <div className="s1-stat-val">{formatSol(stats.treasurySol)}</div>
            <div className="s1-stat-label">SOL Treasury</div>
          </div>
          <div className="s1-stat">
            <div className="s1-stat-val">{formatCompact(stats.totalBurned)}</div>
            <div className="s1-stat-label">Burned</div>
          </div>
          <div className="s1-stat">
            <div className="s1-stat-val">{formatCompact(stats.totalBoughtBack)}</div>
            <div className="s1-stat-label">Bought back</div>
          </div>
        </div>

        <div className="s1-cta">
          <a href="#how" className="s1-btn">See how it works ↓</a>
        </div>
      </div>
    </section>
  );
}
