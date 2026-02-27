/**
 * SoloClaw agent – kører hver 3 min.
 * Flow: claim fees (Pump SDK) → 80% til creator → 20% til buyback/burn eller add LP (PumpSwap SDK).
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT, createTransferInstruction, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID, createBurnInstruction, getAccount } from "@solana/spl-token";
import BN from "bn.js";
import { OnlinePumpSdk, getBuyTokenAmountFromSolAmount, PUMP_SDK } from "@pump-fun/pump-sdk";
import * as PumpSwap from "@pump-fun/pump-swap-sdk";
import { config } from "./config.js";

const LAMPORTS_PER_SOL = 1e9;

export async function runCycle() {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const agent = config.agentKeypair;
  const sdk = new OnlinePumpSdk(connection);

  console.log(`[${new Date().toISOString()}] Starter cyklus...`);

  const balanceLamports = await sdk.getCreatorVaultBalanceBothPrograms(agent.publicKey);
  const balanceSol = balanceLamports.toNumber() / LAMPORTS_PER_SOL;

  if (balanceSol < config.minClaimSol) {
    console.log(`  For lidt at claim (${balanceSol.toFixed(4)} SOL). Spring over.`);
    return;
  }

  const toCreator = balanceSol * 0.8;
  const toTreasury = balanceSol * 0.2;
  const toCreatorLamports = Math.floor(toCreator * LAMPORTS_PER_SOL);
  const toTreasuryLamports = Math.floor(toTreasury * LAMPORTS_PER_SOL);

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

  const sig = await sendAndConfirm(connection, tx, agent);
  console.log(`  Claimed ${balanceSol.toFixed(4)} SOL. Sent ${toCreator.toFixed(4)} til creator. Tx: ${sig}`);

  if (toTreasury < 0.005) {
    console.log("  Treasury andel for lille til buyback/LP. Ferdig.");
    return;
  }

  const buybackFraction = isMigrated ? (Math.random() > 0.5 ? 0.7 : 0.3) : 1;
  const lpFraction = isMigrated ? 1 - buybackFraction : 0;

  if (buybackFraction > 0) {
    await doBuyback(connection, sdk, agent, toTreasury * buybackFraction, isMigrated);
  }

  if (lpFraction > 0 && isMigrated) {
    const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
    await doAddLp(connection, onlineAmm, agent, toTreasury * lpFraction);
  }
}

async function doBuyback(
  connection: Connection,
  sdk: OnlinePumpSdk,
  agent: Keypair,
  solAmount: number,
  isMigrated: boolean
) {
  const solBn = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));

  if (isMigrated) {
    const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
    const poolKey = PumpSwap.canonicalPumpPoolPda(config.mint);
    const swapState = await onlineAmm.swapSolanaState(poolKey, agent.publicKey);
    const buyIx = await PumpSwap.PUMP_AMM_SDK.buyQuoteInput(swapState, solBn, 2);
    const tx = new Transaction().add(...buyIx);
    await sendAndConfirm(connection, tx, agent);
    console.log(`  Buyback (AMM): ${solAmount.toFixed(4)} SOL`);
  } else {
    const global = await sdk.fetchGlobal();
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
      tokenProgram: TOKEN_PROGRAM_ID,
    });
    const tx = new Transaction().add(...buyIx);
    await sendAndConfirm(connection, tx, agent);
    console.log(`  Buyback (bonding): ${solAmount.toFixed(4)} SOL → ~${amount.toString()} tokens`);
  }

  const agentTokenAta = getAssociatedTokenAddressSync(config.mint, agent.publicKey, true);
  const tokenAccount = await getAccount(connection, agentTokenAta);
  const balance = tokenAccount.amount;
  if (balance > 0n) {
    const burnIx = createBurnInstruction(agentTokenAta, config.mint, agent.publicKey, balance, [], TOKEN_PROGRAM_ID);
    const burnTx = new Transaction().add(burnIx);
    await sendAndConfirm(connection, burnTx, agent);
    console.log(`  Burned ${balance.toString()} tokens`);
  }
}

async function doAddLp(
  connection: Connection,
  onlineAmm: PumpSwap.OnlinePumpAmmSdk,
  agent: Keypair,
  solAmount: number
) {
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
  const sig = await sendAndConfirm(connection, tx, agent);
  console.log(`  Add LP: ${solAmount.toFixed(4)} SOL. Tx: ${sig}`);
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

if (require.main === module) {
  runCycle().catch((err) => {
    console.error("Agent fejl:", err);
    process.exit(1);
  });
}
