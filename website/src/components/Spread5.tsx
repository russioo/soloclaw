"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";

const entries = [
  { time: "02m", action: "Claimed 0.34 SOL", detail: "Creator fee from 12 trades" },
  { time: "18m", action: "Bought back 42,000 tokens", detail: "Market buy at 0.000012 SOL" },
  { time: "01h", action: "Burned 85,000 tokens", detail: "Supply reduced to 998.2M" },
  { time: "02h", action: "Added 0.8 SOL to liquidity", detail: "Pool depth +6.2%" },
  { time: "04h", action: "Claimed 0.19 SOL", detail: "Creator fee from 7 trades" },
  { time: "06h", action: "Bought back 28,000 tokens", detail: "Market buy at 0.000013 SOL" },
];

export default function Spread5() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    gsap.from(el.querySelector(".s5-head"), {
      opacity: 0, x: -20, duration: 0.6, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none reverse" },
    });

    el.querySelectorAll(".s5-row").forEach((row, i) => {
      gsap.from(row, {
        opacity: 0, x: -40, duration: 0.7, delay: i * 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 60%", toggleActions: "play none none reverse" },
      });
    });
  }, { scope: ref });

  return (
    <section className="spread s5" ref={ref}>
      <div className="s5-head">
        <span className="s5-head-dot" />
        Live activity
      </div>
      <div className="s5-list">
        {entries.map((e, i) => (
          <div className="s5-row" key={i}>
            <span className="s5-time">{e.time}</span>
            <div>
              <div className="s5-action">{e.action}</div>
              <div className="s5-detail">{e.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
