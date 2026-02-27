"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { useAgentData } from "@/hooks/useAgentData";

export default function Spread3() {
  const ref = useRef<HTMLElement>(null);
  const { thought, thoughtMeta } = useAgentData();

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    gsap.from(el.querySelector(".s3-quote"), {
      opacity: 0,
      y: 20,
      duration: 0.6,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 65%", toggleActions: "play none none reverse" },
    });

    gsap.from(el.querySelector(".s3-meta"), {
      opacity: 0,
      y: 10,
      duration: 0.8,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "center 55%", toggleActions: "play none none reverse" },
    });
  }, { scope: ref });

  return (
    <section className="spread s3" ref={ref}>
      <p className="s3-quote">
        &ldquo;{thought}&rdquo;
        <span className="s3-cursor" />
      </p>
      <div className="s3-meta">{thoughtMeta}</div>
    </section>
  );
}
