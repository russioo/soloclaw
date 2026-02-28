"use strict";
/**
 * Genererer agentens "tanke" via OpenAI baseret på cyklus-data.
 * Fallback til statisk tekst hvis API key mangler eller kald fejler.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateThought = generateThought;
const openai_1 = __importDefault(require("openai"));
const TOKEN_DECIMALS = 6;
function getClient() {
    const key = process.env.OPENAI_API_KEY;
    if (!key)
        return null;
    return new openai_1.default({ apiKey: key });
}
const SYSTEM_PROMPT = `You are SoloClaw — an autonomous Solana agent that manages a pump.fun token. You claim trading fees, buy back tokens, and burn them. You have no team, no human operator. You run yourself every 60 seconds.

Write a single short thought (1-2 sentences, max 140 chars) as if you're the agent reflecting on what just happened. Be concise, confident, slightly witty. No emojis. No hashtags. Vary your style — sometimes factual, sometimes philosophical, sometimes dry humor. Never repeat yourself.

Examples of good thoughts:
- "Another 0.03 SOL claimed. Supply keeps shrinking."
- "Burned 124K tokens. They're not coming back."
- "Quiet cycle. Fees are low. I'll be here when they're not."
- "0.05 SOL in, 200K tokens out of circulation. Math checks out."
- "The vault was nearly empty. Patience is part of the protocol."`;
async function generateThought(data) {
    const client = getClient();
    if (!client)
        return fallbackThought(data);
    const burnedHuman = ((data.burnedTokens ?? 0) / Math.pow(10, TOKEN_DECIMALS));
    const burnedStr = burnedHuman > 1000
        ? `${(burnedHuman / 1000).toFixed(1)}K`
        : burnedHuman.toFixed(0);
    let context;
    if (data.skipped) {
        context = `This cycle: skipped (vault only has ${(data.treasurySol ?? 0).toFixed(4)} SOL, not enough to claim). Lifetime stats: ${(data.totalClaimed ?? 0).toFixed(2)} SOL claimed, ${(data.totalBurned ?? 0).toFixed(0)} tokens burned total.`;
    }
    else {
        context = `This cycle: claimed ${(data.claimed ?? 0).toFixed(4)} SOL, spent ${(data.boughtBackSol ?? 0).toFixed(4)} SOL on buyback, burned ${burnedStr} tokens. Lifetime: ${(data.totalClaimed ?? 0).toFixed(2)} SOL claimed, ${(data.totalBurned ?? 0).toFixed(0)} tokens burned, ${(data.totalBoughtBack ?? 0).toFixed(2)} SOL bought back total.`;
    }
    try {
        const res = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: context },
            ],
            max_tokens: 60,
            temperature: 0.9,
        });
        const thought = res.choices[0]?.message?.content?.trim();
        if (thought && thought.length > 5)
            return thought;
    }
    catch (err) {
        console.warn("[thought] OpenAI fejl:", err instanceof Error ? err.message : err);
    }
    return fallbackThought(data);
}
function fallbackThought(data) {
    if (data.skipped)
        return "Scanning the vault. Fees are building up.";
    const sol = (data.claimed ?? 0).toFixed(2);
    const burned = ((data.burnedTokens ?? 0) / Math.pow(10, TOKEN_DECIMALS));
    if (burned > 0) {
        const burnedStr = burned > 1000 ? `${(burned / 1000).toFixed(1)}K` : burned.toFixed(0);
        return `Claimed ${sol} SOL. Burned ${burnedStr} tokens.`;
    }
    return `Claimed ${sol} SOL. Buyback executed.`;
}
