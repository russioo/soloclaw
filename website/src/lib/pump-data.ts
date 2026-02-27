/**
 * Henter ægte data fra Pump.fun via SDK.
 * Kører kun server-side (Connection, Solana RPC).
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import type { AgentStats } from "./agent-types";

const LAMPORTS_PER_SOL = 1e9;

export type PumpConfig = {
  rpcUrl: string;
  creatorAddress: string;
  mintAddress?: string; // For OnlinePumpSdk / fee sharing
};

export async function fetchPumpStats(config: PumpConfig): Promise<Partial<AgentStats>> {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const sdk = new OnlinePumpSdk(connection);
  const creator = new PublicKey(config.creatorAddress);

  try {
    const balance = await sdk.getCreatorVaultBalanceBothPrograms(creator);
    const solBalance = Number(balance.toString()) / LAMPORTS_PER_SOL;

    return {
      treasurySol: Math.round(solBalance * 10) / 10,
      totalClaimed: Math.round(solBalance * 10) / 10,
      totalCreatorShare: Math.round(solBalance * 0.8 * 10) / 10,
      totalBurned: 0,
      totalBoughtBack: 0,
      totalLpSol: 0,
    };
  } catch (err) {
    console.error("[pump-data] fetchPumpStats error:", err);
    return {};
  }
}
