"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import CloudBg from "./CloudBg";

export default function Spread1() {
  const ref = useRef<HTMLElement>(null);

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

    // Scramble the treasury number
    const valEl = el.querySelector(".s1-stat-val") as HTMLElement;
    if (valEl) {
      const chars = "0123456789.";
      const target = "12.4";
      let frame = 0;
      const totalFrames = 30;
      const iv = setInterval(() => {
        frame++;
        let r = "";
        for (let i = 0; i < target.length; i++) {
          r += frame > totalFrames * ((i + 1) / target.length)
            ? target[i]
            : chars[Math.floor(Math.random() * chars.length)];
        }
        valEl.textContent = r;
        if (frame >= totalFrames * 1.3) {
          clearInterval(iv);
          valEl.textContent = target;
        }
      }, 50);
      return () => clearInterval(iv);
    }
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
            <div className="s1-stat-val">12.4</div>
            <div className="s1-stat-label">SOL Treasury</div>
          </div>
          <div className="s1-stat">
            <div className="s1-stat-val">420K</div>
            <div className="s1-stat-label">Burned</div>
          </div>
          <div className="s1-stat">
            <div className="s1-stat-val">1.2M</div>
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
