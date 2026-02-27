"use client";

import Link from "next/link";

const PUMP_URL = process.env.NEXT_PUBLIC_MINT_ADDRESS
  ? `https://pump.fun/co/${process.env.NEXT_PUBLIC_MINT_ADDRESS}`
  : "https://pump.fun";

export default function HomeHeader() {
  return (
    <header className="home-header">
      <nav className="home-header-nav">
        <a href="https://x.com/soloclawdotfun" target="_blank" rel="noopener noreferrer">X</a>
        <a href={PUMP_URL} target="_blank" rel="noopener noreferrer">Pump.fun</a>
        <Link href="/docs">Docs</Link>
      </nav>
    </header>
  );
}
