"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

const capabilities = [
  { title: "Claim fees", desc: "Pulls creator fees off every trade on the bonding curve." },
  { title: "Buyback", desc: "Reads the market. Buys tokens back when it makes sense." },
  { title: "Add LP", desc: "Deepens the pool. Less slippage, more stability." },
  { title: "Burn", desc: "Removes tokens from supply. Gone forever." },
];

export default function Spread2() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    const panels = el.querySelectorAll<HTMLElement>(".s2-panel");

    panels.forEach((panel, i) => {
      if (i === 0) return;

      gsap.set(panel, { yPercent: 100 });

      ScrollTrigger.create({
        trigger: el,
        start: () => `top+=${(i * window.innerHeight * 0.7)} top`,
        end: () => `top+=${((i + 1) * window.innerHeight * 0.7)} top`,
        scrub: 1,
        animation: gsap.to(panel, { yPercent: 0, ease: "none" }),
      });
    });

    ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: () => `+=${panels.length * window.innerHeight * 0.7}`,
      pin: true,
    });
  }, { scope: ref });

  return (
    <div className="s2-wrap" ref={ref}>
      {capabilities.map((c, i) => (
        <div className="s2-panel" key={i}>
          <div className="s2-panel-idx">{String(i + 1).padStart(2, "0")}</div>
          <div className="s2-panel-title">{c.title}</div>
          <div className="s2-panel-desc">{c.desc}</div>
        </div>
      ))}
    </div>
  );
}
