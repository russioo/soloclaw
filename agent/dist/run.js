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
        /* bonding curve stadig */
    }
    // Claim fees – SDK instruktionerne lukker wSOL ATA og unwrapper til SOL.
    const claimIx = await sdk.collectCoinCreatorFeeInstructions(agent.publicKey, agent.publicKey);
    const tx = new web3_js_1.Transaction().add(...claimIx);
    const sig = await sendAndConfirm(connection, tx, agent);
    console.log(`  Claimed ${balanceSol.toFixed(4)} SOL. Tx: ${sig}`);
    if (balanceSol < 0.005) {
        console.log("  For lidt til buyback/LP. Ferdig.");
        return {
            ok: true,
            claimed: balanceSol,
            creatorShare: 0,
            boughtBackSol: 0,
            burnedTokens: 0,
            lpSol: 0,
            treasurySol: balanceSol,
        };
    }
    // 100% af claimed fees → buyback + burn (+ LP hvis migrated)
    const buybackFraction = isMigrated ? 0.5 : 1;
    const lpFraction = isMigrated ? 0.5 : 0;
    const buybackAmount = balanceSol * buybackFraction;
    const lpAmount = balanceSol * lpFraction;
    let boughtBackSol = 0;
    let burnedTokens = 0;
    let lpSol = 0;
    if (lpFraction > 0 && isMigrated) {
        const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
        await doAddLp(connection, onlineAmm, agent, lpAmount);
        lpSol = lpAmount;
    }
    if (buybackFraction > 0) {
        burnedTokens = await doBuyback(connection, sdk, agent, buybackAmount, isMigrated);
        boughtBackSol = buybackAmount;
    }
    return {
        ok: true,
        claimed: balanceSol,
        creatorShare: 0,
        boughtBackSol,
        burnedTokens,
        lpSol,
        treasurySol: balanceSol,
    };
}
async function doBuyback(connection, sdk, agent, solAmount, isMigrated) {
    const agentTokenAta = (0, spl_token_1.getAssociatedTokenAddressSync)(config_js_1.config.mint, agent.publicKey, true, spl_token_1.TOKEN_2022_PROGRAM_ID);
    const solBn = new bn_js_1.default(Math.floor(solAmount * LAMPORTS_PER_SOL));
    async function buyViaAmm() {
        const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
        const poolKey = PumpSwap.canonicalPumpPoolPda(config_js_1.config.mint);
        const swapState = await onlineAmm.swapSolanaState(poolKey, agent.publicKey);
        const buyIx = await PumpSwap.PUMP_AMM_SDK.buyQuoteInput(swapState, solBn, 2);
        appendV2Account(buyIx, PUMP_AMM_PROGRAM_ID, poolV2Pda(config_js_1.config.mint));
        const tx = new web3_js_1.Transaction().add(...buyIx);
        await sendAndConfirm(connection, tx, agent);
        console.log(`  Buyback (AMM): ${solAmount.toFixed(4)} SOL`);
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
        await sendAndConfirm(connection, tx, agent);
        console.log(`  Buyback (bonding): ${solAmount.toFixed(4)} SOL → ~${amount.toString()} tokens`);
    }
    if (isMigrated) {
        await buyViaAmm();
    }
    else {
        try {
            await buyViaBondingCurve();
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("BondingCurveComplete") || msg.includes("0x1775")) {
                console.log("  Bonding curve complete – skifter til AMM...");
                await buyViaAmm();
            }
            else {
                throw err;
            }
        }
    }
    // Vent på at token-balance opdateres efter buyback
    await sleep(3000);
    let balance = await getTokenBalance(connection, agentTokenAta);
    if (balance === BigInt(0)) {
        await sleep(3000);
        balance = await getTokenBalance(connection, agentTokenAta);
    }
    if (balance > BigInt(0)) {
        console.log(`  [Burn] ${balance} tokens i wallet → brænder alt`);
        const burnIx = (0, spl_token_1.createBurnInstruction)(agentTokenAta, config_js_1.config.mint, agent.publicKey, balance, [], spl_token_1.TOKEN_2022_PROGRAM_ID);
        await sendAndConfirm(connection, new web3_js_1.Transaction().add(burnIx), agent);
        console.log(`  Burned ${balance.toString()} tokens`);
        return Number(balance);
    }
    console.log("  Ingen tokens at brænde.");
    return 0;
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
    const poolKey = PumpSwap.canonicalPumpPoolPda(config_js_1.config.mint);
    const liquidityState = await onlineAmm.liquiditySolanaState(poolKey, agent.publicKey);
    const quoteAmount = new bn_js_1.default(Math.floor(solAmount * LAMPORTS_PER_SOL));
    const slippage = 2;
    const pumpAmmSdk = new PumpSwap.PumpAmmSdk();
    const { base, lpToken } = await pumpAmmSdk.depositAutocompleteBaseAndLpTokenFromQuote(liquidityState, quoteAmount, slippage);
    const depositIx = await pumpAmmSdk.depositInstructions(liquidityState, lpToken, slippage);
    const tx = new web3_js_1.Transaction().add(...depositIx);
    const sig = await sendAndConfirm(connection, tx, agent);
    console.log(`  Add LP: ${solAmount.toFixed(4)} SOL. Tx: ${sig}`);
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
