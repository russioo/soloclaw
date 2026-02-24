"use client";
import { useEffect, useRef } from "react";

export default function CloudBg() {
  const ref = useRef<HTMLDivElement>(null);
  const vantaRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (cancelled || !ref.current) return;

      const THREE = await import("three");
      (window as any).THREE = THREE;

      // @ts-expect-error vanta has no types
      const FOG = (await import("vanta/dist/vanta.fog.min")).default;

      if (cancelled || !ref.current) return;

      try {
        vantaRef.current = FOG({
          el: ref.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: ref.current.offsetHeight || window.innerHeight,
          minWidth: ref.current.offsetWidth || window.innerWidth,
          highlightColor: 0xe8e1d8,
          midtoneColor: 0xd4ccc0,
          lowlightColor: 0xb8b3ac,
          baseColor: 0xf6f3ee,
          blurFactor: 0.4,
          speed: 0.8,
          zoom: 1.1,
        });
      } catch (e) {
        console.warn("Vanta init failed:", e);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (vantaRef.current) vantaRef.current.destroy();
    };
  }, []);

  return <div ref={ref} className="fog-bg" />;
}
