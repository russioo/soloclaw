"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, SplitText } from "@/lib/gsap";

export default function Spread6() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    const statement = el.querySelector(".s6-statement") as HTMLElement;
    if (!statement) return;

    const split = new SplitText(statement, { type: "chars" });

    gsap.from(split.chars, {
      opacity: 0, y: 50, rotateX: -60,
      stagger: 0.03, duration: 0.7, ease: "back.out(2)",
      scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none reverse" },
    });

    gsap.from(el.querySelectorAll(".s6-link"), {
      opacity: 0, y: 16, stagger: 0.1, duration: 0.6, delay: 0.5,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none reverse" },
    });
  }, { scope: ref });

  return (
    <section className="spread s6" ref={ref}>
      <div className="s6-statement">No team. No keys. Just code.</div>
      <div className="s6-links">
        <a className="s6-link" href="https://x.com/soloclawdotfun" target="_blank" rel="noopener noreferrer">X</a>
        <a className="s6-link" href="https://pump.fun" target="_blank" rel="noopener noreferrer">Pump.fun</a>
        <a className="s6-link" href="/docs">Docs</a>
      </div>
    </section>
  );
}
