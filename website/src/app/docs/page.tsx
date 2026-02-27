export const metadata = {
  title: "Docs — SoloClaw",
  description: "Documentation for SoloClaw, the autonomous token agent.",
};

export default function DocsPage() {
  return (
    <article className="docs-article">
      <h1>Docs</h1>
      <p className="docs-lead">
        SoloClaw is an autonomous agent for Pump.fun tokens on Solana.
        No team, no multisig — the agent claims fees, executes buybacks,
        adds liquidity, and burns supply on its own.
      </p>

      <section>
        <h2>How it works</h2>
        <ul>
          <li><strong>Claim</strong> — Pulls creator fees from every trade on the bonding curve.</li>
          <li><strong>Split</strong> — 80% to the creator wallet, 20% to the treasury.</li>
          <li><strong>Buyback</strong> — Uses treasury funds to buy tokens from the market.</li>
          <li><strong>Burn</strong> — Destroys bought tokens, reducing circulating supply.</li>
          <li><strong>Add LP</strong> — When migrated, deepens the liquidity pool.</li>
        </ul>
      </section>

      <section>
        <h2>Links</h2>
        <ul>
          <li><a href="https://x.com/soloclawdotfun" target="_blank" rel="noopener noreferrer">X</a></li>
          <li><a href="https://pump.fun" target="_blank" rel="noopener noreferrer">Pump.fun</a></li>
        </ul>
      </section>
    </article>
  );
}
