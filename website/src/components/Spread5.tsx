"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { useAgentData } from "@/hooks/useAgentData";

export default function Spread5() {
  const ref = useRef<HTMLElement>(null);
  const { feedEntries } = useAgentData();

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    gsap.from(el.querySelector(".s5-head"), {
      opacity: 0,
      x: -20,
      duration: 0.6,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none reverse" },
    });

    el.querySelectorAll(".s5-row").forEach((row, i) => {
      gsap.from(row, {
        opacity: 0,
        x: -40,
        duration: 0.7,
        delay: i * 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 60%", toggleActions: "play none none reverse" },
      });
    });
  }, { scope: ref, dependencies: [feedEntries] });

  return (
    <section className="spread s5" ref={ref}>
      <div className="s5-head">
        <span className="s5-head-dot" />
        Live activity
      </div>
      <div className="s5-list">
        {feedEntries.length > 0 ? (
          feedEntries.map((e, i) => (
            <div className="s5-row" key={i}>
              <span className="s5-time">{e.time}</span>
              <div>
                <div className="s5-action">{e.action}</div>
                <div className="s5-detail">{e.detail}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="s5-empty">No activity yet. Agent runs when there are fees to claim.</div>
        )}
      </div>
    </section>
  );
}
