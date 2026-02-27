/**
 * SoloClaw agent – kører hver 3 min.
 * Flow: claim fees (Pump SDK) → 80% til creator → 20% til buyback/burn eller add LP (PumpSwap SDK).
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT, createTransferInstruction, createAssociatedTokenAccountIdempotentInstruction, TOKEN_2022_PROGRAM_ID, createBurnInstruction, getAccount } from "@solana/spl-token";
import BN from "bn.js";
import { OnlinePumpSdk, getBuyTokenAmountFromSolAmount, PUMP_SDK } from "@pump-fun/pump-sdk";
import * as PumpSwap from "@pump-fun/pump-swap-sdk";
import { config } from "./config.js";

const LAMPORTS_PER_SOL = 1e9;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function rpcDelay(): Promise<void> {
  await sleep(config.rpcDelayMs);
}

export type CycleResult =
  | { ok: true; skipped: true; reason: string; treasurySol?: number }
  | { ok: true; claimed: number; creatorShare: number; boughtBackSol: number; burnedTokens: number; lpSol: number; treasurySol?: number }
  | { ok: false; error: string };

export async function runCycle(): Promise<CycleResult> {
  const connection = new Connection(config.rpcUrl, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 90_000,
  });
  const agent = config.agentKeypair;
  const sdk = new OnlinePumpSdk(connection);

  console.log(`[${new Date().toISOString()}] Starter cyklus...`);
  await rpcDelay();

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

  const toCreator = balanceSol * 0.8;
  const toTreasury = balanceSol * 0.2;
  const toCreatorLamports = Math.floor(toCreator * LAMPORTS_PER_SOL);
  const toTreasuryLamports = Math.floor(toTreasury * LAMPORTS_PER_SOL);

  await rpcDelay();
  let isMigrated = false;
  try {
    const feeResult = await sdk.getMinimumDistributableFee(config.mint);
    isMigrated = feeResult.isGraduated;
  } catch {
    /* bonding curve stadig */
  }

  const claimIx = await sdk.collectCoinCreatorFeeInstructions(agent.publicKey, agent.publicKey);
  const tx = new Transaction().add(...claimIx);

  const agentAta = getAssociatedTokenAddressSync(NATIVE_MINT, agent.publicKey, true);
  const creatorAta = getAssociatedTokenAddressSync(NATIVE_MINT, config.creatorWallet, true);

  tx.add(createAssociatedTokenAccountIdempotentInstruction(agent.publicKey, creatorAta, config.creatorWallet, NATIVE_MINT));
  tx.add(
    createTransferInstruction(
      agentAta,
      creatorAta,
      agent.publicKey,
      toCreatorLamports
    )
  );

  await rpcDelay();
  const sig = await sendAndConfirm(connection, tx, agent);
  console.log(`  Claimed ${balanceSol.toFixed(4)} SOL. Sent ${toCreator.toFixed(4)} til creator. Tx: ${sig}`);

  if (toTreasury < 0.005) {
    console.log("  Treasury andel for lille til buyback/LP. Ferdig.");
    return {
      ok: true,
      claimed: balanceSol,
      creatorShare: toCreator,
      boughtBackSol: 0,
      burnedTokens: 0,
      lpSol: 0,
      treasurySol: balanceSol,
    };
  }

  const buybackFraction = isMigrated ? (Math.random() > 0.5 ? 0.7 : 0.3) : 1;
  const lpFraction = isMigrated ? 1 - buybackFraction : 0;
  const buybackAmount = toTreasury * buybackFraction;
  const lpAmount = toTreasury * lpFraction;

  let boughtBackSol = 0;
  let burnedTokens = 0;
  let lpSol = 0;

  if (buybackFraction > 0) {
    await rpcDelay();
    burnedTokens = await doBuyback(connection, sdk, agent, buybackAmount, isMigrated);
    boughtBackSol = buybackAmount;
  }

  if (lpFraction > 0 && isMigrated) {
    await rpcDelay();
    const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
    await doAddLp(connection, onlineAmm, agent, lpAmount);
    lpSol = lpAmount;
  }

  return {
    ok: true,
    claimed: balanceSol,
    creatorShare: toCreator,
    boughtBackSol,
    burnedTokens,
    lpSol,
    treasurySol: balanceSol,
  };
}

async function doBuyback(
  connection: Connection,
  sdk: OnlinePumpSdk,
  agent: Keypair,
  solAmount: number,
  isMigrated: boolean
): Promise<number> {
  await rpcDelay();
  const agentTokenAta = getAssociatedTokenAddressSync(config.mint, agent.publicKey, true, TOKEN_2022_PROGRAM_ID);
  const balanceBefore = await getTokenBalance(connection, agentTokenAta);
  if (balanceBefore > BigInt(0)) {
    console.log(`  [Sikkerhed] balanceBefore=${balanceBefore} (bevares – brænder IKKE disse)`);
  }

  const solBn = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));

  if (isMigrated) {
    await rpcDelay();
    const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
    const poolKey = PumpSwap.canonicalPumpPoolPda(config.mint);
    const swapState = await onlineAmm.swapSolanaState(poolKey, agent.publicKey);
    const buyIx = await PumpSwap.PUMP_AMM_SDK.buyQuoteInput(swapState, solBn, 2);
    const tx = new Transaction().add(...buyIx);
    await rpcDelay();
    await sendAndConfirm(connection, tx, agent);
    console.log(`  Buyback (AMM): ${solAmount.toFixed(4)} SOL`);
  } else {
    await rpcDelay();
    const global = await sdk.fetchGlobal();
    await rpcDelay();
    const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = await sdk.fetchBuyState(
      config.mint,
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
      mint: config.mint,
      user: agent.publicKey,
      solAmount: solBn,
      amount,
      slippage: 2,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });
    const tx = new Transaction().add(...buyIx);
    await rpcDelay();
    await sendAndConfirm(connection, tx, agent);
    console.log(`  Buyback (bonding): ${solAmount.toFixed(4)} SOL → ~${amount.toString()} tokens`);
  }

  await rpcDelay();
  const balanceAfter = await getTokenBalance(connection, agentTokenAta);
  const boughtAmount = BigInt(Math.max(0, Number(balanceAfter) - Number(balanceBefore)));

  if (boughtAmount > BigInt(0)) {
    console.log(`  [Burn] balanceBefore=${balanceBefore} balanceAfter=${balanceAfter} → brænder kun boughtAmount=${boughtAmount}`);
    const burnIx = createBurnInstruction(agentTokenAta, config.mint, agent.publicKey, boughtAmount, [], TOKEN_2022_PROGRAM_ID);
    await rpcDelay();
    await sendAndConfirm(connection, new Transaction().add(burnIx), agent);
    console.log(`  Burned ${boughtAmount.toString()} tokens (kun fra denne buyback)`);
    return Number(boughtAmount);
  }
  if (balanceBefore > BigInt(0) && balanceAfter === balanceBefore) {
    console.log(`  [Sikkerhed] Ingen nye tokens købt – brænder intet. Eksisterende ${balanceBefore} bevaret.`);
  }
  return 0;
}

async function getTokenBalance(connection: Connection, ata: PublicKey): Promise<bigint> {
  try {
    await rpcDelay();
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
) {
  await rpcDelay();
  const poolKey = PumpSwap.canonicalPumpPoolPda(config.mint);
  const liquidityState = await onlineAmm.liquiditySolanaState(poolKey, agent.publicKey);
  const quoteAmount = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));
  const slippage = 2;

  const pumpAmmSdk = new PumpSwap.PumpAmmSdk();
  const { base, lpToken } = await pumpAmmSdk.depositAutocompleteBaseAndLpTokenFromQuote(
    liquidityState,
    quoteAmount,
    slippage
  );

  const depositIx = await pumpAmmSdk.depositInstructions(liquidityState, lpToken, slippage);
  const tx = new Transaction().add(...depositIx);
  await rpcDelay();
  const sig = await sendAndConfirm(connection, tx, agent);
  console.log(`  Add LP: ${solAmount.toFixed(4)} SOL. Tx: ${sig}`);
}

async function sendAndConfirm(
  connection: Connection,
  tx: Transaction,
  signer: Keypair
): Promise<string> {
  tx.feePayer = signer.publicKey;
  await rpcDelay();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.sign(signer);

  await rpcDelay();
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await rpcDelay();

  try {
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return sig;
  } catch (err) {
    // Tjek om tx faktisk landede (RPC kan timeout selvom tx gik igennem)
    const status = await connection.getSignatureStatus(sig).catch(() => null);
    if (status?.value?.confirmationStatus === "confirmed" || status?.value?.confirmationStatus === "finalized") {
      console.log(`  [Bekræftelse] Tx ${sig.slice(0, 16)}... ok (RPC timeout, men tx landede)`);
      return sig;
    }
    throw err;
  }
}

if (require.main === module) {
  runCycle()
    .then((r) => console.log("Resultat:", r))
    .catch((err) => {
      console.error("Agent fejl:", err);
      process.exit(1);
    });
}
