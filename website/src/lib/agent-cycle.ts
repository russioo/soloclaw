/**
 * Agent cycle – claim, 80/20, buyback, burn, add LP.
 * Kører som Vercel Cron.
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_2022_PROGRAM_ID,
  createBurnInstruction,
  getAccount,
} from "@solana/spl-token";
import BN from "bn.js";
import { OnlinePumpSdk, getBuyTokenAmountFromSolAmount, PUMP_SDK } from "@pump-fun/pump-sdk";
import * as PumpSwap from "@pump-fun/pump-swap-sdk";
import bs58 from "bs58";

const LAMPORTS_PER_SOL = 1e9;

function loadKeypair(secret: string): Keypair {
  if (!secret?.trim()) throw new Error("AGENT_PRIVATE_KEY mangler");
  try {
    return Keypair.fromSecretKey(bs58.decode(secret));
  } catch {
    const arr = JSON.parse(secret) as number[];
    return Keypair.fromSecretKey(new Uint8Array(arr));
  }
}

export async function runAgentCycle() {
  const rpcUrl = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  const agent = loadKeypair(process.env.AGENT_PRIVATE_KEY!);
  const creatorWallet = new PublicKey(process.env.CREATOR_WALLET!);
  const mint = new PublicKey(process.env.MINT_ADDRESS ?? process.env.NEXT_PUBLIC_MINT_ADDRESS ?? "");

  const connection = new Connection(rpcUrl, "confirmed");
  const sdk = new OnlinePumpSdk(connection);

  const balanceLamports = await sdk.getCreatorVaultBalanceBothPrograms(agent.publicKey);
  const balanceSol = balanceLamports.toNumber() / LAMPORTS_PER_SOL;
  const minClaim = parseFloat(process.env.MIN_CLAIM_SOL ?? "0.01");

  if (balanceSol < minClaim) {
    return { ok: true, skipped: true, reason: "Not enough to claim", treasurySol: balanceSol };
  }

  const toCreator = balanceSol * 0.8;
  const toTreasury = balanceSol * 0.2;
  let boughtBackSol = 0;
  let burnedTokens = 0;
  let lpSol = 0;
  const toCreatorLamports = Math.floor(toCreator * LAMPORTS_PER_SOL);

  let isMigrated = false;
  try {
    const feeResult = await sdk.getMinimumDistributableFee(mint);
    isMigrated = feeResult.isGraduated;
  } catch {
    /* bonding curve */
  }

  const claimIx = await sdk.collectCoinCreatorFeeInstructions(agent.publicKey, agent.publicKey);
  const tx = new Transaction().add(...claimIx);

  const agentAta = getAssociatedTokenAddressSync(NATIVE_MINT, agent.publicKey, true);
  const creatorAta = getAssociatedTokenAddressSync(NATIVE_MINT, creatorWallet, true);

  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(agent.publicKey, creatorAta, creatorWallet, NATIVE_MINT)
  );
  tx.add(createTransferInstruction(agentAta, creatorAta, agent.publicKey, toCreatorLamports));

  const sig = await sendAndConfirm(connection, tx, agent);

  if (toTreasury < 0.005) {
    return {
      ok: true,
      claimed: balanceSol,
      creatorShare: toCreator,
      boughtBackSol: 0,
      burnedTokens: 0,
      lpSol: 0,
      tx: sig,
    };
  }

  const buybackFraction = isMigrated ? (Math.random() > 0.5 ? 0.7 : 0.3) : 1;
  const lpFraction = isMigrated ? 1 - buybackFraction : 0;
  const buybackAmount = toTreasury * buybackFraction;
  const lpAmount = toTreasury * lpFraction;

  if (buybackFraction > 0) {
    const burnCount = await doBuyback(connection, sdk, agent, mint, buybackAmount, isMigrated);
    boughtBackSol = buybackAmount;
    burnedTokens = burnCount;
  }

  if (lpFraction > 0 && isMigrated) {
    const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
    await doAddLp(connection, onlineAmm, agent, mint, lpAmount);
    lpSol = lpAmount;
  }

  return {
    ok: true,
    claimed: balanceSol,
    creatorShare: toCreator,
    boughtBackSol,
    burnedTokens,
    lpSol,
    tx: sig,
  };
}

async function doBuyback(
  connection: Connection,
  sdk: OnlinePumpSdk,
  agent: Keypair,
  mint: PublicKey,
  solAmount: number,
  isMigrated: boolean
): Promise<number> {
  const agentTokenAta = getAssociatedTokenAddressSync(mint, agent.publicKey, true, TOKEN_2022_PROGRAM_ID);
  const balanceBefore = await getTokenBalance(connection, agentTokenAta);

  const solBn = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));

  if (isMigrated) {
    const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
    const poolKey = PumpSwap.canonicalPumpPoolPda(mint);
    const swapState = await onlineAmm.swapSolanaState(poolKey, agent.publicKey);
    const buyIx = await PumpSwap.PUMP_AMM_SDK.buyQuoteInput(swapState, solBn, 2);
    const tx = new Transaction().add(...buyIx);
    await sendAndConfirm(connection, tx, agent);
  } else {
    const global = await sdk.fetchGlobal();
    const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = await sdk.fetchBuyState(
      mint,
      agent.publicKey
    );
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig: null,
      mintSupply: bondingCurve.virtualTokenReserves,
      bondingCurve,
      amount: solBn,
    });
    const buyIx = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: bondingCurveAccountInfo!,
      bondingCurve,
      associatedUserAccountInfo: associatedUserAccountInfo!,
      mint,
      user: agent.publicKey,
      solAmount: solBn,
      amount,
      slippage: 2,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });
    const tx = new Transaction().add(...buyIx);
    await sendAndConfirm(connection, tx, agent);
  }

  const balanceAfter = await getTokenBalance(connection, agentTokenAta);
  const boughtAmount = BigInt(Math.max(0, Number(balanceAfter) - Number(balanceBefore)));

  if (boughtAmount > BigInt(0)) {
    const burnIx = createBurnInstruction(
      agentTokenAta,
      mint,
      agent.publicKey,
      boughtAmount,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    await sendAndConfirm(connection, new Transaction().add(burnIx), agent);
    return Number(boughtAmount);
  }
  return 0;
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
  mint: PublicKey,
  solAmount: number
) {
  const poolKey = PumpSwap.canonicalPumpPoolPda(mint);
  const liquidityState = await onlineAmm.liquiditySolanaState(poolKey, agent.publicKey);
  const quoteAmount = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));
  const pumpAmmSdk = new PumpSwap.PumpAmmSdk();
  const { lpToken } = await pumpAmmSdk.depositAutocompleteBaseAndLpTokenFromQuote(
    liquidityState,
    quoteAmount,
    2
  );
  const depositIx = await pumpAmmSdk.depositInstructions(liquidityState, lpToken, 2);
  await sendAndConfirm(connection, new Transaction().add(...depositIx), agent);
}

async function sendAndConfirm(
  connection: Connection,
  tx: Transaction,
  signer: Keypair
): Promise<string> {
  tx.feePayer = signer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(signer);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(sig);
  return sig;
}
