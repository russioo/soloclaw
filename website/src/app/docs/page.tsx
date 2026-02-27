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
        <h2>Connecting your backend</h2>
        <p>
          To run the agent on your own PC (so your private key stays local) and let Vercel trigger it:
        </p>
        <ol className="docs-steps">
          <li>
            <strong>In the agent folder:</strong> Copy <code>.env.example</code> to <code>.env</code> and set <code>AGENT_PRIVATE_KEY</code>, <code>CREATOR_WALLET</code>, <code>MINT_ADDRESS</code>.
          </li>
          <li>
            <strong>Start the agent server:</strong><br />
            <code>npm run dev:server</code>
            <br />
            This starts an HTTP server on port 3456 (or <code>AGENT_PORT</code>).
          </li>
          <li>
            <strong>Expose your PC with ngrok:</strong> In a separate terminal:<br />
            <code>npx ngrok http 3456</code>
            <br />
            Copy the HTTPS URL ngrok gives you (e.g. <code>https://abc123.ngrok-free.app</code>).
          </li>
          <li>
            <strong>In Vercel:</strong> Add an environment variable <code>AGENT_BACKEND_URL</code> with your ngrok URL.
          </li>
          <li>
            <strong>Deploy.</strong> When someone visits your site, Vercel will call your PC via ngrok. Your PC runs the agent (with the private key) and returns the result. Vercel saves stats to Supabase.
          </li>
        </ol>
        <p>
          You do <em>not</em> need <code>AGENT_PRIVATE_KEY</code> on Vercel when using this setup.
        </p>
      </section>

      <section>
        <h2>RPC / QuickNode</h2>
        <p>
          The default Solana RPC (<code>api.mainnet-beta.solana.com</code>) has rate limits and can fail under load.
          For production, use a dedicated RPC like <a href="https://quicknode.com" target="_blank" rel="noopener noreferrer">QuickNode</a> or <a href="https://helius.dev" target="_blank" rel="noopener noreferrer">Helius</a>.
        </p>
        <p>
          In <code>agent/.env</code>: set <code>RPC_URL=https://xxx.solana-mainnet.quiknode.pro/YOUR_TOKEN/</code>
        </p>
        <p>
          On Vercel (if agent runs there): add <code>RPC_URL</code> or <code>NEXT_PUBLIC_RPC_URL</code>.
        </p>
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
