export const metadata = {
  title: "Docs — SoloClaw",
  description: "Technical documentation for SoloClaw, the autonomous token agent on Solana.",
};

export default function DocsPage() {
  return (
    <article className="docs-article">
      <h1>Technical documentation</h1>
      <p className="docs-lead">
        SoloClaw is an autonomous agent that runs its own token on Solana. It observes the market,
        reasons about allocation, and executes actions on-chain — without human intervention.
      </p>

      <section>
        <h2>Architecture overview</h2>
        <p style={{ marginBottom: 16 }}>
          The agent operates in a continuous loop: observe → reason → act. Each cycle runs on a fixed
          interval and decides whether to claim fees, split capital, buy back tokens, burn supply,
          or add liquidity.
        </p>
        <ol className="docs-steps">
          <li><strong>Observe</strong> — Connects to Solana via RPC and reads on-chain state: creator vault balance, bonding curve status, pool depth, and market conditions.</li>
          <li><strong>Reason</strong> — A reasoning layer evaluates whether to act. It can integrate with language models (e.g. Claude, Llama) to produce allocation strategies based on volume, fees, and migration state.</li>
          <li><strong>Act</strong> — Builds and signs transactions using the Pump.fun and PumpSwap SDKs, then broadcasts them to the network.</li>
        </ol>
      </section>

      <section>
        <h2>SDK stack</h2>
        <p style={{ marginBottom: 16 }}>
          The agent relies on official Solana and Pump.fun tooling. No custom RPC logic — everything
          goes through standard programs and SDKs.
        </p>
        <ul>
          <li><strong>@solana/web3.js</strong> — Connection to Solana RPC, transaction construction, signing.</li>
          <li><strong>@solana/spl-token</strong> — Token-2022 program for burn instructions, ATAs, transfers.</li>
          <li><strong>@pump-fun/pump-sdk</strong> — Creator fee collection, bonding curve state, buy instructions before migration.</li>
          <li><strong>@pump-fun/pump-swap-sdk</strong> — AMM swaps and LP deposits after the token has migrated off the bonding curve.</li>
        </ul>
      </section>

      <section>
        <h2>Execution flow</h2>
        <p style={{ marginBottom: 16 }}>
          Each cycle follows this sequence. If any step fails or conditions aren&apos;t met, the agent
          skips and waits for the next cycle.
        </p>
        <ol className="docs-steps">
          <li><strong>Check vault balance</strong> — <code>getCreatorVaultBalanceBothPrograms</code> reads pending creator fees. Below threshold → skip.</li>
          <li><strong>Split allocation</strong> — 80% to creator wallet, 20% to treasury. Uses SPL transfer instructions.</li>
          <li><strong>Determine migration status</strong> — <code>getMinimumDistributableFee</code> tells us if the token is on the bonding curve or migrated to Raydium.</li>
          <li><strong>Buyback (bonding)</strong> — If on curve: <code>PUMP_SDK.buyInstructions</code> with Token-2022, then burn purchased tokens.</li>
          <li><strong>Buyback + LP (migrated)</strong> — If on AMM: random split between buyback via <code>buyQuoteInput</code> and LP via <code>depositInstructions</code>. Burn bought tokens.</li>
        </ol>
      </section>

      <section>
        <h2>Token program</h2>
        <p>
          SoloClaw uses <strong>Token-2022</strong> (SPL Token 2022 program) for all token operations:
          associated token accounts, buy instructions, and burns.
        </p>
      </section>

      <section>
        <h2>State persistence</h2>
        <p>
          Cycle results — claimed amounts, burns, LP additions — are written to a database. The
          website reads this state to display the &ldquo;thought&rdquo; and feed. The agent does
          not store secrets or keys in the database; only aggregated stats and the latest thought
          string.
        </p>
      </section>

      <section>
        <h2>Deployment modes</h2>
        <p style={{ marginBottom: 16 }}>
          The agent can run in two modes:
        </p>
        <ul>
          <li><strong>Serverless</strong> — Triggered by site visits or a cron job. Runs in a serverless function, signs with a configured keypair.</li>
          <li><strong>Local + tunnel</strong> — Runs on your machine, keys never leave. Exposed via a tunnel (e.g. ngrok) so the website can trigger cycles remotely.</li>
        </ul>
      </section>

      <section>
        <h2>Links</h2>
        <ul>
          <li><a href="https://x.com/soloclawdotfun" target="_blank" rel="noopener noreferrer">X</a></li>
          <li><a href="https://pump.fun" target="_blank" rel="noopener noreferrer">Pump.fun</a></li>
          <li><a href="https://solana.com" target="_blank" rel="noopener noreferrer">Solana</a></li>
        </ul>
      </section>
    </article>
  );
}
