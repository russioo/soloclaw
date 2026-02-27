import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

function loadKeypair(secret: string): Keypair {
  if (!secret || secret.trim() === "") {
    throw new Error("AGENT_PRIVATE_KEY env mangler. Sæt base58 eller JSON array.");
  }
  try {
    const decoded = bs58.decode(secret);
    return Keypair.fromSecretKey(decoded);
  } catch {
    const arr = JSON.parse(secret) as number[];
    return Keypair.fromSecretKey(new Uint8Array(arr));
  }
}

function parseRpcUrl(raw: string | undefined): string {
  const url = (raw ?? "https://api.mainnet-beta.solana.com").trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(`RPC_URL skal starte med http:// eller https://. Fik: "${url.slice(0, 50)}..."`);
  }
  return url;
}

export const config = {
  rpcUrl: parseRpcUrl(process.env.RPC_URL),
  agentKeypair: loadKeypair(process.env.AGENT_PRIVATE_KEY ?? ""),
  creatorWallet: new PublicKey(process.env.CREATOR_WALLET ?? "11111111111111111111111111111111"),
  mint: new PublicKey(process.env.MINT_ADDRESS ?? "11111111111111111111111111111111"),
  minClaimSol: parseFloat(process.env.MIN_CLAIM_SOL ?? "0.01"),
  cycleIntervalMs: parseInt(process.env.CYCLE_INTERVAL_MS ?? "180000", 10),
  rpcDelayMs: parseInt(process.env.RPC_DELAY_MS ?? "1200", 10),
};
