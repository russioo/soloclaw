"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
function loadKeypair(secret) {
    if (!secret || secret.trim() === "") {
        throw new Error("AGENT_PRIVATE_KEY env mangler. Sæt base58 eller JSON array.");
    }
    try {
        const decoded = bs58_1.default.decode(secret);
        return web3_js_1.Keypair.fromSecretKey(decoded);
    }
    catch {
        const arr = JSON.parse(secret);
        return web3_js_1.Keypair.fromSecretKey(new Uint8Array(arr));
    }
}
function parseRpcUrl(raw) {
    const url = (raw ?? "https://api.mainnet-beta.solana.com").trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error(`RPC_URL skal starte med http:// eller https://. Fik: "${url.slice(0, 50)}..."`);
    }
    return url;
}
exports.config = {
    rpcUrl: parseRpcUrl(process.env.RPC_URL),
    agentKeypair: loadKeypair(process.env.AGENT_PRIVATE_KEY ?? ""),
    creatorWallet: new web3_js_1.PublicKey(process.env.CREATOR_WALLET ?? "11111111111111111111111111111111"),
    mint: new web3_js_1.PublicKey(process.env.MINT_ADDRESS ?? "11111111111111111111111111111111"),
    minClaimSol: parseFloat(process.env.MIN_CLAIM_SOL ?? "0.01"),
    cycleIntervalMs: parseInt(process.env.CYCLE_INTERVAL_MS ?? "180000", 10),
};
