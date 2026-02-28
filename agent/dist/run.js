"use strict";
/**
 * SoloClaw agent – kører hvert 60. sekund.
 * Flow: claim fees → 100% buyback + burn (+ LP hvis migrated).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCycle = runCycle;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bn_js_1 = __importDefault(require("bn.js"));
const pump_sdk_1 = require("@pump-fun/pump-sdk");
const PumpSwap = __importStar(require("@pump-fun/pump-swap-sdk"));
const config_js_1 = require("./config.js");
const LAMPORTS_PER_SOL = 1e9;
const PUMP_PROGRAM_ID = new web3_js_1.PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_AMM_PROGRAM_ID = new web3_js_1.PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
function bondingCurveV2Pda(mint) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("bonding-curve-v2"), mint.toBuffer()], PUMP_PROGRAM_ID)[0];
}
function poolV2Pda(baseMint) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("pool-v2"), baseMint.toBuffer()], PUMP_AMM_PROGRAM_ID)[0];
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
const STRATEGIES = [
    { name: "burn-heavy", buybackFraction: 0.85, lpFraction: 0.15, weight: 30 },
    { name: "balanced", buybackFraction: 0.50, lpFraction: 0.50, weight: 25 },
    { name: "lp-focus", buybackFraction: 0.15, lpFraction: 0.85, weight: 20 },
    { name: "full-burn", buybackFraction: 1.0, lpFraction: 0.0, weight: 15 },
    { name: "full-lp", buybackFraction: 0.0, lpFraction: 1.0, weight: 10 },
];
function pickStrategy() {
    const totalWeight = STRATEGIES.reduce((sum, s) => sum + s.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const s of STRATEGIES) {
        roll -= s.weight;
        if (roll <= 0)
            return { name: s.name, buybackFraction: s.buybackFraction, lpFraction: s.lpFraction };
    }
    return STRATEGIES[0];
}
async function runCycle() {
    const connection = new web3_js_1.Connection(config_js_1.config.rpcUrl, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 90_000,
    });
    const agent = config_js_1.config.agentKeypair;
    const sdk = new pump_sdk_1.OnlinePumpSdk(connection);
    console.log(`[${new Date().toISOString()}] Starter cyklus...`);
    let balanceSol = 0;
    try {
        const balanceLamports = await sdk.getCreatorVaultBalanceBothPrograms(agent.publicKey);
        balanceSol = balanceLamports.toNumber() / LAMPORTS_PER_SOL;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("TokenAccountNotFoundError") || msg.includes("NotFound")) {
            balanceSol = 0;
        }
        else {
            throw err;
        }
    }
    if (balanceSol < config_js_1.config.minClaimSol) {
        console.log(`  For lidt at claim (${balanceSol.toFixed(4)} SOL). Spring over.`);
        return { ok: true, skipped: true, reason: "For lidt at claim", treasurySol: balanceSol };
    }
    let isMigrated = false;
    try {
        const feeResult = await sdk.getMinimumDistributableFee(config_js_1.config.mint);
        isMigrated = feeResult.isGraduated;
    }
    catch {
        // Fallback: tjek om AMM pool eksisterer
        try {
            const poolKey = PumpSwap.canonicalPumpPoolPda(config_js_1.config.mint);
            const poolInfo = await connection.getAccountInfo(poolKey);
            if (poolInfo)
                isMigrated = true;
        }
        catch { /* antag bonding curve */ }
    }
    console.log(`  Migrated: ${isMigrated}`);
    const txs = [];
    const now = () => new Date().toISOString();
    const claimIx = await sdk.collectCoinCreatorFeeInstructions(agent.publicKey, agent.publicKey);
    const tx = new web3_js_1.Transaction().add(...claimIx);
    const sig = await sendAndConfirm(connection, tx, agent);
    txs.push({ sig, type: "claim", time: now() });
    console.log(`  Claimed ${balanceSol.toFixed(4)} SOL. Tx: ${sig}`);
    // --- ops split ---
    const creatorCut = 0.70;
    const creatorLamports = Math.floor(balanceSol * creatorCut * LAMPORTS_PER_SOL);
    if (creatorLamports > 0) {
        const sendTx = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({ fromPubkey: agent.publicKey, toPubkey: config_js_1.config.creatorWallet, lamports: creatorLamports }));
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
    let strategy;
    if (isMigrated) {
        strategy = pickStrategy();
        console.log(`  Strategy: ${strategy.name} (${Math.round(strategy.buybackFraction * 100)}% buyback, ${Math.round(strategy.lpFraction * 100)}% LP)`);
    }
    else {
        strategy = { name: "bonding-curve", buybackFraction: 1, lpFraction: 0 };
    }
    const buybackFraction = strategy.buybackFraction;
    const lpFraction = strategy.lpFraction;
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
        }
        catch (err) {
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
        strategy: strategy.name,
    };
}
async function doBuyback(connection, sdk, agent, solAmount, isMigrated) {
    const sigs = [];
    const now = () => new Date().toISOString();
    const agentTokenAta = (0, spl_token_1.getAssociatedTokenAddressSync)(config_js_1.config.mint, agent.publicKey, true, spl_token_1.TOKEN_2022_PROGRAM_ID);
    const solBn = new bn_js_1.default(Math.floor(solAmount * LAMPORTS_PER_SOL));
    async function buyViaAmm() {
        const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
        const poolKey = PumpSwap.canonicalPumpPoolPda(config_js_1.config.mint);
        const swapState = await onlineAmm.swapSolanaState(poolKey, agent.publicKey);
        const buyIx = await PumpSwap.PUMP_AMM_SDK.buyQuoteInput(swapState, solBn, 2);
        appendV2Account(buyIx, PUMP_AMM_PROGRAM_ID, poolV2Pda(config_js_1.config.mint));
        const tx = new web3_js_1.Transaction().add(...buyIx);
        const s = await sendAndConfirm(connection, tx, agent);
        console.log(`  Buyback (AMM): ${solAmount.toFixed(4)} SOL`);
        return s;
    }
    async function buyViaBondingCurve() {
        const global = await sdk.fetchGlobal();
        const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = await sdk.fetchBuyState(config_js_1.config.mint, agent.publicKey, spl_token_1.TOKEN_2022_PROGRAM_ID);
        const amount = (0, pump_sdk_1.getBuyTokenAmountFromSolAmount)({
            global,
            feeConfig: null,
            mintSupply: bondingCurve.tokenTotalSupply,
            bondingCurve,
            amount: solBn,
        });
        const buyIx = await pump_sdk_1.PUMP_SDK.buyInstructions({
            global,
            bondingCurveAccountInfo,
            bondingCurve,
            associatedUserAccountInfo,
            mint: config_js_1.config.mint,
            user: agent.publicKey,
            solAmount: solBn,
            amount,
            slippage: 2,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        });
        appendV2Account(buyIx, PUMP_PROGRAM_ID, bondingCurveV2Pda(config_js_1.config.mint));
        const tx = new web3_js_1.Transaction().add(...buyIx);
        const s = await sendAndConfirm(connection, tx, agent);
        console.log(`  Buyback (bonding): ${solAmount.toFixed(4)} SOL → ~${amount.toString()} tokens`);
        return s;
    }
    let buySig;
    if (isMigrated) {
        buySig = await buyViaAmm();
    }
    else {
        try {
            buySig = await buyViaBondingCurve();
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("BondingCurveComplete") || msg.includes("0x1775")) {
                console.log("  Bonding curve complete – skifter til AMM...");
                buySig = await buyViaAmm();
            }
            else {
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
        const burnIx = (0, spl_token_1.createBurnInstruction)(agentTokenAta, config_js_1.config.mint, agent.publicKey, balance, [], spl_token_1.TOKEN_2022_PROGRAM_ID);
        const burnSig = await sendAndConfirm(connection, new web3_js_1.Transaction().add(burnIx), agent);
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
function appendV2Account(instructions, programId, v2Pda) {
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
async function getTokenBalance(connection, ata) {
    try {
        const acc = await (0, spl_token_1.getAccount)(connection, ata, "confirmed", spl_token_1.TOKEN_2022_PROGRAM_ID);
        return acc.amount;
    }
    catch {
        return BigInt(0);
    }
}
async function doAddLp(connection, onlineAmm, agent, solAmount) {
    const records = [];
    const now = () => new Date().toISOString();
    const poolKey = PumpSwap.canonicalPumpPoolPda(config_js_1.config.mint);
    const buySol = solAmount * 0.65;
    const depositSol = solAmount * 0.35;
    const solBn = new bn_js_1.default(Math.floor(buySol * LAMPORTS_PER_SOL));
    const swapState = await onlineAmm.swapSolanaState(poolKey, agent.publicKey);
    const buyIx = await PumpSwap.PUMP_AMM_SDK.buyQuoteInput(swapState, solBn, 5);
    appendV2Account(buyIx, PUMP_AMM_PROGRAM_ID, poolV2Pda(config_js_1.config.mint));
    const buyTx = new web3_js_1.Transaction().add(...buyIx);
    const buySig = await sendAndConfirm(connection, buyTx, agent);
    records.push({ sig: buySig, type: "lp-buy", time: now() });
    console.log(`  LP zap: købt tokens med ${buySol.toFixed(4)} SOL`);
    await sleep(4000);
    const liquidityState = await onlineAmm.liquiditySolanaState(poolKey, agent.publicKey);
    const quoteAmount = new bn_js_1.default(Math.floor(depositSol * LAMPORTS_PER_SOL));
    const slippage = 10;
    const pumpAmmSdk = new PumpSwap.PumpAmmSdk();
    const { lpToken } = await pumpAmmSdk.depositAutocompleteBaseAndLpTokenFromQuote(liquidityState, quoteAmount, slippage);
    const depositIx = await pumpAmmSdk.depositInstructions(liquidityState, lpToken, slippage);
    appendV2Account(depositIx, PUMP_AMM_PROGRAM_ID, poolV2Pda(config_js_1.config.mint));
    const tx = new web3_js_1.Transaction().add(...depositIx);
    const depSig = await sendAndConfirm(connection, tx, agent);
    records.push({ sig: depSig, type: "lp-deposit", time: now() });
    console.log(`  Add LP: ${depositSol.toFixed(4)} SOL + tokens. Tx: ${depSig}`);
    return records;
}
async function sendAndConfirm(connection, tx, signer) {
    tx.feePayer = signer.publicKey;
    // Compute budget FØRST i transaktionen
    const computeIx = [
        web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
        web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
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
            const result = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
            if (result.value.err) {
                throw new Error(`Tx fejlede on-chain: ${JSON.stringify(result.value.err)}`);
            }
            return sig;
        }
        catch (err) {
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
