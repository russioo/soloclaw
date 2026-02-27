"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const path_1 = require("path");
const dotenv_1 = __importDefault(require("dotenv"));
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
dotenv_1.default.config();
dotenv_1.default.config({ path: (0, path_1.join)(process.cwd(), ".env.local"), override: true });
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
const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
function parseRpcUrl(raw) {
    const url = (raw ?? DEFAULT_RPC).trim();
    if (!url)
        throw new Error("RPC_URL mangler");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error(`RPC_URL skal starte med http:// eller https://. Fik: "${url.slice(0, 50)}..."`);
    }
    return url;
}
const rpcRaw = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC;
exports.config = {
    rpcUrl: parseRpcUrl(rpcRaw),
    agentKeypair: loadKeypair(process.env.AGENT_PRIVATE_KEY ?? ""),
    creatorWallet: new web3_js_1.PublicKey(process.env.CREATOR_WALLET ?? "11111111111111111111111111111111"),
    mint: new web3_js_1.PublicKey(process.env.MINT_ADDRESS ?? "11111111111111111111111111111111"),
    minClaimSol: parseFloat(process.env.MIN_CLAIM_SOL ?? "0.01"),
    cycleIntervalMs: parseInt(process.env.CYCLE_INTERVAL_MS ?? "60000", 10),
    rpcDelayMs: parseInt(process.env.RPC_DELAY_MS ?? "200", 10),
};
