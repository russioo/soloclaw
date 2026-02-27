"use strict";
/**
 * SoloClaw agent – kører hver 3 min.
 * Flow: claim fees (Pump SDK) → 80% til creator → 20% til buyback/burn eller add LP (PumpSwap SDK).
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
async function runCycle() {
    const connection = new web3_js_1.Connection(config_js_1.config.rpcUrl, "confirmed");
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
    const toCreator = balanceSol * 0.8;
    const toTreasury = balanceSol * 0.2;
    const toCreatorLamports = Math.floor(toCreator * LAMPORTS_PER_SOL);
    const toTreasuryLamports = Math.floor(toTreasury * LAMPORTS_PER_SOL);
    let isMigrated = false;
    try {
        const feeResult = await sdk.getMinimumDistributableFee(config_js_1.config.mint);
        isMigrated = feeResult.isGraduated;
    }
    catch {
        /* bonding curve stadig */
    }
    const claimIx = await sdk.collectCoinCreatorFeeInstructions(agent.publicKey, agent.publicKey);
    const tx = new web3_js_1.Transaction().add(...claimIx);
    const agentAta = (0, spl_token_1.getAssociatedTokenAddressSync)(spl_token_1.NATIVE_MINT, agent.publicKey, true);
    const creatorAta = (0, spl_token_1.getAssociatedTokenAddressSync)(spl_token_1.NATIVE_MINT, config_js_1.config.creatorWallet, true);
    tx.add((0, spl_token_1.createAssociatedTokenAccountIdempotentInstruction)(agent.publicKey, creatorAta, config_js_1.config.creatorWallet, spl_token_1.NATIVE_MINT));
    tx.add((0, spl_token_1.createTransferInstruction)(agentAta, creatorAta, agent.publicKey, toCreatorLamports));
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
        burnedTokens = await doBuyback(connection, sdk, agent, buybackAmount, isMigrated);
        boughtBackSol = buybackAmount;
    }
    if (lpFraction > 0 && isMigrated) {
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
async function doBuyback(connection, sdk, agent, solAmount, isMigrated) {
    const agentTokenAta = (0, spl_token_1.getAssociatedTokenAddressSync)(config_js_1.config.mint, agent.publicKey, true, spl_token_1.TOKEN_2022_PROGRAM_ID);
    const balanceBefore = await getTokenBalance(connection, agentTokenAta);
    if (balanceBefore > BigInt(0)) {
        console.log(`  [Sikkerhed] balanceBefore=${balanceBefore} (bevares – brænder IKKE disse)`);
    }
    const solBn = new bn_js_1.default(Math.floor(solAmount * LAMPORTS_PER_SOL));
    if (isMigrated) {
        const onlineAmm = new PumpSwap.OnlinePumpAmmSdk(connection);
        const poolKey = PumpSwap.canonicalPumpPoolPda(config_js_1.config.mint);
        const swapState = await onlineAmm.swapSolanaState(poolKey, agent.publicKey);
        const buyIx = await PumpSwap.PUMP_AMM_SDK.buyQuoteInput(swapState, solBn, 2);
        const tx = new web3_js_1.Transaction().add(...buyIx);
        await sendAndConfirm(connection, tx, agent);
        console.log(`  Buyback (AMM): ${solAmount.toFixed(4)} SOL`);
    }
    else {
        const global = await sdk.fetchGlobal();
        const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = await sdk.fetchBuyState(config_js_1.config.mint, agent.publicKey);
        const amount = (0, pump_sdk_1.getBuyTokenAmountFromSolAmount)({
            global,
            feeConfig: null,
            mintSupply: bondingCurve.virtualTokenReserves,
            bondingCurve,
            amount: solBn,
        });
        const buyIx = await pump_sdk_1.PUMP_SDK.buyInstructions({
            global,
            bondingCurveAccountInfo: bondingCurveAccountInfo,
            bondingCurve,
            associatedUserAccountInfo: associatedUserAccountInfo,
            mint: config_js_1.config.mint,
            user: agent.publicKey,
            solAmount: solBn,
            amount,
            slippage: 2,
            tokenProgram: spl_token_1.TOKEN_2022_PROGRAM_ID,
        });
        const tx = new web3_js_1.Transaction().add(...buyIx);
        await sendAndConfirm(connection, tx, agent);
        console.log(`  Buyback (bonding): ${solAmount.toFixed(4)} SOL → ~${amount.toString()} tokens`);
    }
    const balanceAfter = await getTokenBalance(connection, agentTokenAta);
    const boughtAmount = BigInt(Math.max(0, Number(balanceAfter) - Number(balanceBefore)));
    if (boughtAmount > BigInt(0)) {
        console.log(`  [Burn] balanceBefore=${balanceBefore} balanceAfter=${balanceAfter} → brænder kun boughtAmount=${boughtAmount}`);
        const burnIx = (0, spl_token_1.createBurnInstruction)(agentTokenAta, config_js_1.config.mint, agent.publicKey, boughtAmount, [], spl_token_1.TOKEN_2022_PROGRAM_ID);
        await sendAndConfirm(connection, new web3_js_1.Transaction().add(burnIx), agent);
        console.log(`  Burned ${boughtAmount.toString()} tokens (kun fra denne buyback)`);
        return Number(boughtAmount);
    }
    if (balanceBefore > BigInt(0) && balanceAfter === balanceBefore) {
        console.log(`  [Sikkerhed] Ingen nye tokens købt – brænder intet. Eksisterende ${balanceBefore} bevaret.`);
    }
    return 0;
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
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(signer);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction(sig);
    return sig;
}
if (require.main === module) {
    runCycle()
        .then((r) => console.log("Resultat:", r))
        .catch((err) => {
        console.error("Agent fejl:", err);
        process.exit(1);
    });
}
