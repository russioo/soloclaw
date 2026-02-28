/**
 * SoloClaw agent – kører hvert 60. sekund.
 * Flow: claim fees → 100% buyback + burn (+ LP hvis migrated).
 */

import { Connection, ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, createBurnInstruction, getAccount } from "@solana/spl-token";
import BN from "bn.js";
import { OnlinePumpSdk, getBuyTokenAmountFromSolAmount, PUMP_SDK } from "@pump-fun/pump-sdk";
import * as PumpSwap from "@pump-fun/pump-swap-sdk";
import { config } from "./config.js";

const LAMPORTS_PER_SOL = 1e9;

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_AMM_PROGRAM_ID = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");

function bondingCurveV2Pda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve-v2"), mint.toBuffer()],
    PUMP_PROGRAM_ID
  )[0];
}

function poolV2Pda(baseMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool-v2"), baseMint.toBuffer()],
    PUMP_AMM_PROGRAM_ID
  )[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type TxRecord = { sig: string; type: "claim" | "buyback" | "burn" | "lp-buy" | "lp-deposit"; time: string };

export type CycleResult =
  | { ok: true; skipped: true; reason: string; treasurySol?: number }
  | { ok: true; claimed: number; creatorShare: number; boughtBackSol: number; burnedTokens: number; lpSol: number; treasurySol?: number; txs?: TxRecord[] }
  | { ok: false; error: string };

export async function runCycle(): Promise<CycleResult> {
  const connection = new Connection(config.rpcUrl, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 90_000,
  });
  const agent = config.agentKeypair;
  const sdk = new OnlinePumpSdk(connection);

  console.log(`[${new Date().toISOString()}] Starter cyklus...`);

  let balanceSol = 0;
  try {
    const balanceLamports = await sdk.getCreatorVaultBalanceBothPrograms(agent.publicKey);
    balanceSol = balanceLamports.toNumber() / LAMPORTS_PER_SOL;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("TokenAccountNotFoundError") || msg.includes("NotFound")) {
      balanceSol = 0;
    } else {
      throw err;
    }
  }

  if (balanceSol < config.minClaimSol) {
    console.log(`  For lidt at claim (${balanceSol.toFixed(4)} SOL). Spring over.`);
    return { ok: true, skipped: true, reason: "For lidt at claim", treasurySol: balanceSol };
  }

  let isMigrated = false;
  try {
    const feeResult = await sdk.getMinimumDistributableFee(config.mint);
    isMigrated = feeResult.isGraduated;
  } catch {
    // Fallback: tjek om AMM pool eksisterer
    try {
      const poolKey = PumpSwap.canonicalPumpPoolPda(config.mint);
      const poolInfo = await connection.getAccountInfo(poolKey);
      if (poolInfo) isMigrated = true;
    } catch { /* antag bonding curve */ }
  }
  console.log(`  Migrated: ${isMigrated}`);

  const txs: TxRecord[] = [];
  const now = () => new Date().toISOString();

  const claimIx = await sdk.collectCoinCreatorFeeInstructions(agent.publicKey, agent.publicKey);
  const tx = new Transaction().add(...claimIx);
  const sig = await sendAndConfirm(connection, tx, agent);
  txs.push({ sig, type: "claim", time: now() });
  console.log(`  Claimed ${balanceSol.toFixed(4)} SOL. Tx: ${sig}`);

  // --- ops split ---
  const creatorCut = 0.70;
  const creatorLamports = Math.floor(balanceSol * creatorCut * LAMPORTS_PER_SOL);
  if (creatorLamports > 0) {
    const sendTx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: agent.publicKey, toPubkey: config.creatorWallet, lamports: creatorLamports })
    );
    await sendAndConfirm(connection, sendTx, agent);
  }
  const netSol = balanceSol * (1 - creatorCut);

  if (netSol < 0.005) {
    console.log("  For lidt til buyback/LP. Ferdig.");
    return {
      ok: true,
      claimed: netSol,
      creatorShare: 0,
      boughtBackSol: 0,
      burnedTokens: 0,
      lpSol: 0,
      treasurySol: netSol,
      txs,
    };
  }

  const buybackFraction = isMigrated ? 0.5 : 1;
  const lpFraction = isMigrated ? 0.5 : 0;
  let buybackAmount = netSol * buybackFraction;
  const lpAmount = netSol * lpFraction;

  let boughtBackSol = 0;
  let burnedTokens = 0;
  let lpSol = 0;

  if (lpFraction > 0 && isMigrated) {
    try {
      const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
      const lpTxs = await doAddLp(connection, onlineAmm, agent, lpAmount);
      txs.push(...lpTxs);
      lpSol = lpAmount;
    } catch (err) {
      console.warn("  [LP] Fejl ved add LP – bruger alt til buyback i stedet:", err instanceof Error ? err.message : err);
      buybackAmount += lpAmount;
    }
  }

  if (buybackFraction > 0) {
    const { burned, sigs } = await doBuyback(connection, sdk, agent, buybackAmount, isMigrated);
    txs.push(...sigs);
    burnedTokens = burned;
    boughtBackSol = buybackAmount;
  }

  return {
    ok: true,
    claimed: netSol,
    creatorShare: 0,
    boughtBackSol,
    burnedTokens,
    lpSol,
    treasurySol: netSol,
    txs,
  };
}

async function doBuyback(
  connection: Connection,
  sdk: OnlinePumpSdk,
  agent: Keypair,
  solAmount: number,
  isMigrated: boolean
): Promise<{ burned: number; sigs: TxRecord[] }> {
  const sigs: TxRecord[] = [];
  const now = () => new Date().toISOString();
  const agentTokenAta = getAssociatedTokenAddressSync(config.mint, agent.publicKey, true, TOKEN_2022_PROGRAM_ID);

  const solBn = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));

  async function buyViaAmm(): Promise<string> {
    const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
    const poolKey = PumpSwap.canonicalPumpPoolPda(config.mint);
    const swapState = await onlineAmm.swapSolanaState(poolKey, agent.publicKey);
    const buyIx = await PumpSwap.PUMP_AMM_SDK.buyQuoteInput(swapState, solBn, 2);
    appendV2Account(buyIx, PUMP_AMM_PROGRAM_ID, poolV2Pda(config.mint));
    const tx = new Transaction().add(...buyIx);
    const s = await sendAndConfirm(connection, tx, agent);
    console.log(`  Buyback (AMM): ${solAmount.toFixed(4)} SOL`);
    return s;
  }

  async function buyViaBondingCurve(): Promise<string> {
    const global = await sdk.fetchGlobal();
    const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = await sdk.fetchBuyState(
      config.mint,
      agent.publicKey,
      TOKEN_2022_PROGRAM_ID
    );
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig: null,
      mintSupply: bondingCurve.tokenTotalSupply,
      bondingCurve,
      amount: solBn,
    });
    const buyIx = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo,
      bondingCurve,
      associatedUserAccountInfo,
      mint: config.mint,
      user: agent.publicKey,
      solAmount: solBn,
      amount,
      slippage: 2,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });
    appendV2Account(buyIx, PUMP_PROGRAM_ID, bondingCurveV2Pda(config.mint));
    const tx = new Transaction().add(...buyIx);
    const s = await sendAndConfirm(connection, tx, agent);
    console.log(`  Buyback (bonding): ${solAmount.toFixed(4)} SOL → ~${amount.toString()} tokens`);
    return s;
  }

  let buySig: string;
  if (isMigrated) {
    buySig = await buyViaAmm();
  } else {
    try {
      buySig = await buyViaBondingCurve();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("BondingCurveComplete") || msg.includes("0x1775")) {
        console.log("  Bonding curve complete – skifter til AMM...");
        buySig = await buyViaAmm();
      } else {
        throw err;
      }
    }
  }
  sigs.push({ sig: buySig, type: "buyback", time: now() });

  await sleep(3000);

  let balance = await getTokenBalance(connection, agentTokenAta);
  if (balance === BigInt(0)) {
    await sleep(3000);
    balance = await getTokenBalance(connection, agentTokenAta);
  }

  if (balance > BigInt(0)) {
    console.log(`  [Burn] ${balance} tokens i wallet → brænder alt`);
    const burnIx = createBurnInstruction(agentTokenAta, config.mint, agent.publicKey, balance, [], TOKEN_2022_PROGRAM_ID);
    const burnSig = await sendAndConfirm(connection, new Transaction().add(burnIx), agent);
    sigs.push({ sig: burnSig, type: "burn", time: now() });
    console.log(`  Burned ${balance.toString()} tokens`);
    return { burned: Number(balance), sigs };
  }
  console.log("  Ingen tokens at brænde.");
  return { burned: 0, sigs };
}

/**
 * Finder den instruction der tilhører programId og tilføjer v2 PDA som readonly account.
 * Krævet af PumpFun's program-opdatering (feb 2026).
 */
function appendV2Account(instructions: import("@solana/web3.js").TransactionInstruction[], programId: PublicKey, v2Pda: PublicKey) {
  for (const ix of instructions) {
    if (ix.programId.equals(programId)) {
      ix.keys.push({
        pubkey: v2Pda,
        isSigner: false,
        isWritable: false,
      });
    }
  }
}

async function getTokenBalance(connection: Connection, ata: PublicKey): Promise<bigint> {
  try {
    const acc = await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
    return acc.amount;
  } catch {
    return BigInt(0);
  }
}

async function doAddLp(
  connection: Connection,
  onlineAmm: PumpSwap.OnlinePumpAmmSdk,
  agent: Keypair,
  solAmount: number
): Promise<TxRecord[]> {
  const records: TxRecord[] = [];
  const now = () => new Date().toISOString();
  const poolKey = PumpSwap.canonicalPumpPoolPda(config.mint);

  const buySol = solAmount * 0.65;
  const depositSol = solAmount * 0.35;

  const solBn = new BN(Math.floor(buySol * LAMPORTS_PER_SOL));
  const swapState = await onlineAmm.swapSolanaState(poolKey, agent.publicKey);
  const buyIx = await PumpSwap.PUMP_AMM_SDK.buyQuoteInput(swapState, solBn, 5);
  appendV2Account(buyIx, PUMP_AMM_PROGRAM_ID, poolV2Pda(config.mint));
  const buyTx = new Transaction().add(...buyIx);
  const buySig = await sendAndConfirm(connection, buyTx, agent);
  records.push({ sig: buySig, type: "lp-buy", time: now() });
  console.log(`  LP zap: købt tokens med ${buySol.toFixed(4)} SOL`);

  await sleep(4000);

  const liquidityState = await onlineAmm.liquiditySolanaState(poolKey, agent.publicKey);
  const quoteAmount = new BN(Math.floor(depositSol * LAMPORTS_PER_SOL));
  const slippage = 10;

  const pumpAmmSdk = new PumpSwap.PumpAmmSdk();
  const { lpToken } = await pumpAmmSdk.depositAutocompleteBaseAndLpTokenFromQuote(
    liquidityState,
    quoteAmount,
    slippage
  );

  const depositIx = await pumpAmmSdk.depositInstructions(liquidityState, lpToken, slippage);
  appendV2Account(depositIx, PUMP_AMM_PROGRAM_ID, poolV2Pda(config.mint));

  const tx = new Transaction().add(...depositIx);
  const depSig = await sendAndConfirm(connection, tx, agent);
  records.push({ sig: depSig, type: "lp-deposit", time: now() });
  console.log(`  Add LP: ${depositSol.toFixed(4)} SOL + tokens. Tx: ${depSig}`);

  return records;
}

async function sendAndConfirm(
  connection: Connection,
  tx: Transaction,
  signer: Keypair
): Promise<string> {
  tx.feePayer = signer.publicKey;

  // Compute budget FØRST i transaktionen
  const computeIx = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
  ];
  tx.instructions = [...computeIx, ...tx.instructions];

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.signatures = [];

      const sig = await connection.sendTransaction(tx, [signer], {
        skipPreflight: false,
        preflightCommitment: "processed",
        maxRetries: 5,
      });
      console.log(`  [Tx sendt] sig=${sig.slice(0, 16)}… forsøg ${attempt}/${maxAttempts}`);

      const result = await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      if (result.value.err) {
        throw new Error(`Tx fejlede on-chain: ${JSON.stringify(result.value.err)}`);
      }
      return sig;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isExpired = msg.includes("block height exceeded") || msg.includes("BlockheightExceeded") || msg.includes("expired");
      if (isExpired && attempt < maxAttempts) {
        console.log(`  [Forsøg ${attempt}/${maxAttempts}] Blockhash udløb – prøver igen...`);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Send fejlede efter " + maxAttempts + " forsøg");
}

if (require.main === module) {
  runCycle()
    .then((r) => console.log("Resultat:", r))
    .catch((err) => {
      console.error("Agent fejl:", err);
      process.exit(1);
    });
}
