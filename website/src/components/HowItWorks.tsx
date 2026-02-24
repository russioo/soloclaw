"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, SplitText } from "@/lib/gsap";

export default function HowItWorks() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    const heading = el.querySelector(".hiw-heading") as HTMLElement;
    if (heading) {
      const split = new SplitText(heading, { type: "words" });
      gsap.from(split.words, {
        opacity: 0.08, stagger: 0.05, duration: 0.4, ease: "none",
        scrollTrigger: { trigger: el, start: "top 70%", end: "top 30%", scrub: 1 },
      });
    }

    el.querySelectorAll(".hiw-step").forEach((step, i) => {
      gsap.from(step, {
        opacity: 0, y: 50, duration: 0.9, delay: i * 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: step, start: "top 80%", toggleActions: "play none none reverse" },
      });
    });
  }, { scope: ref });

  return (
    <section className="spread hiw" id="how" ref={ref}>
      <p className="hiw-heading">
        Most tokens depend on a team to make decisions.
        SoloClaw removes the team entirely. The agent watches the market
        24/7, claims fees as they come in, and decides in real-time
        how to allocate capital — buyback, liquidity, or burn.
      </p>

      <div className="hiw-steps">
        <div className="hiw-step">
          <div className="hiw-step-num">01</div>
          <div className="hiw-step-body">
            <h3 className="hiw-step-title">Trades happen on Pump.fun</h3>
            <p className="hiw-step-text">
              Every buy and sell generates a creator fee. The fee flows directly
              to the agent&apos;s wallet — not to any person.
            </p>
          </div>
        </div>

        <div className="hiw-step">
          <div className="hiw-step-num">02</div>
          <div className="hiw-step-body">
            <h3 className="hiw-step-title">The agent claims and decides</h3>
            <p className="hiw-step-text">
              SoloClaw monitors volume, price action, and pool depth.
              It claims pending fees and decides how to split them — some
              to buy back tokens, some to deepen liquidity.
            </p>
          </div>
        </div>

        <div className="hiw-step">
          <div className="hiw-step-num">03</div>
          <div className="hiw-step-body">
            <h3 className="hiw-step-title">Buyback and burn</h3>
            <p className="hiw-step-text">
              When the agent buys back, those tokens get burned. Gone from
              supply forever. This creates a deflationary loop —
              more trading means more fees, more burns, less supply.
            </p>
          </div>
        </div>

        <div className="hiw-step">
          <div className="hiw-step-num">04</div>
          <div className="hiw-step-body">
            <h3 className="hiw-step-title">Liquidity grows automatically</h3>
            <p className="hiw-step-text">
              A portion of every fee cycle goes back to the pool. Deeper pool
              means less slippage, more stable price, and a better trading
              experience for everyone.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
