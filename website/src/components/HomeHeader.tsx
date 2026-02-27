"use client";

import Link from "next/link";

export default function HomeHeader() {
  return (
    <header className="home-header">
      <nav className="home-header-nav">
        <a href="https://x.com/soloclawdotfun" target="_blank" rel="noopener noreferrer">X</a>
        <a href="https://pump.fun" target="_blank" rel="noopener noreferrer">Pump.fun</a>
        <Link href="/docs">Docs</Link>
      </nav>
    </header>
  );
}
