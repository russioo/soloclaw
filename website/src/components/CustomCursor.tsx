"use client";
import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

export default function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      gsap.to(dot.current, { x: e.clientX, y: e.clientY, duration: 0.1, ease: "power2.out" });
      gsap.to(ring.current, { x: e.clientX, y: e.clientY, duration: 0.35, ease: "power2.out" });
    };

    const onEnterLink = () => {
      gsap.to(ring.current, { scale: 2.2, opacity: 0.15, duration: 0.3 });
      gsap.to(dot.current, { scale: 0.5, duration: 0.3 });
    };

    const onLeaveLink = () => {
      gsap.to(ring.current, { scale: 1, opacity: 0.4, duration: 0.3 });
      gsap.to(dot.current, { scale: 1, duration: 0.3 });
    };

    window.addEventListener("mousemove", onMove);

    const links = document.querySelectorAll("a, .s5-link, .s1-name");
    links.forEach((el) => {
      el.addEventListener("mouseenter", onEnterLink);
      el.addEventListener("mouseleave", onLeaveLink);
    });

    return () => {
      window.removeEventListener("mousemove", onMove);
      links.forEach((el) => {
        el.removeEventListener("mouseenter", onEnterLink);
        el.removeEventListener("mouseleave", onLeaveLink);
      });
    };
  }, []);

  return (
    <>
      <div ref={dot} className="cursor-dot" />
      <div ref={ring} className="cursor-ring" />
    </>
  );
}
