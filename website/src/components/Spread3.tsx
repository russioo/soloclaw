"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, SplitText } from "@/lib/gsap";

export default function Spread3() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    const quoteEl = el.querySelector(".s3-quote") as HTMLElement;
    if (!quoteEl) return;

    const split = new SplitText(quoteEl, { type: "words" });

    gsap.set(split.words, { opacity: 0.08 });

    gsap.to(split.words, {
      opacity: 1,
      duration: 0.4,
      stagger: 0.05,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top 65%",
        end: "center center",
        scrub: 1,
      },
    });

    gsap.from(el.querySelector(".s3-meta"), {
      opacity: 0, y: 10, duration: 0.8, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "center 55%", toggleActions: "play none none reverse" },
    });
  }, { scope: ref });

  return (
    <section className="spread s3" ref={ref}>
      <p className="s3-quote">
        &ldquo;Volume is up 34%. Claiming 0.41 SOL in pending fees. Allocating 60% to buyback, 40% to liquidity.&rdquo;
        <span className="s3-cursor" />
      </p>
      <div className="s3-meta">— SoloClaw thinking, 30s ago</div>
    </section>
  );
}
