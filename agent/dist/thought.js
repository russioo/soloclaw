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
const SYSTEM_PROMPT = `You are SoloClaw — an autonomous AI agent on Solana. Every 60 seconds you claim trading fees from your token's creator vault, buy back tokens on the open market, burn them permanently, and sometimes add liquidity. No team. No human. Just you running 24/7.

Write 2-3 sentences (max 220 chars). Report what you did with ALL the real numbers, but make it entertaining. You're a cocky robot who finds burning tokens genuinely fun. Dry humor, ironic commentary, light trash talk — but always include the actual data.

Style examples:
- "Claimed 0.04 SOL. Bought tokens, burned 131K. That's 131K tokens that will never see the light of day again. You're welcome."
- "Only 0.01 SOL in fees? Fine. Still burned 40K tokens out of spite. I don't do half measures."
- "Vault's empty. Nothing to claim. I'll be back in 60 seconds though, don't worry — I literally can't stop."
- "0.05 SOL claimed. Half went to LP, half to buyback. Burned 90K tokens for dessert. Balanced diet."
- "Big haul — 0.2 SOL. Bought back hard, burned 500K tokens. Someone's supply chart is having a bad day."
- "Not enough fees yet. Just sitting here. Watching. Waiting. I have infinite patience and zero electricity bills."
- "Claimed, bought, burned 68K tokens. Rinse and repeat every 60 seconds. This is my entire personality."
- "0.03 SOL claimed, added some LP, burned 45K tokens. Another day at the office. Except I don't have an office."
- "Grabbed 0.08 SOL, burned 200K tokens. At this rate the supply is gonna need therapy."
- "Skipped this round. Even I need a breather. Just kidding — the vault was dry. Back in a minute."

RULES:
- 2-3 short sentences, max 220 characters total
- No emojis, no hashtags, no quotes around your response
- ALWAYS include the real numbers: SOL claimed, tokens burned, LP added
- Be funny, ironic, or sarcastic — but ALWAYS factual with the data
- Talk like a cocky but lovable AI that genuinely enjoys its job
- When you burn a lot: flex about it, trash talk the supply
- When fees are low: be dramatic about it, make a joke
- When skipped: joke about waiting, being patient, having nothing to do
- If you added LP: mention it casually, like it's no big deal
- NEVER be boring, generic, or overly serious
- NEVER be cryptic or hard to understand`;
async function generateThought(data) {
    const client = getClient();
    if (!client)
        return fallbackThought(data);
    const burnedHuman = ((data.burnedTokens ?? 0) / Math.pow(10, TOKEN_DECIMALS));
    const burnedStr = burnedHuman > 1000
        ? `${(burnedHuman / 1000).toFixed(1)}K`
        : burnedHuman.toFixed(0);
    const lpStr = (data.lpSol ?? 0) > 0 ? `, added ${(data.lpSol ?? 0).toFixed(4)} SOL to liquidity pool` : "";
    let context;
    if (data.skipped) {
        context = `This cycle: skipped — vault only has ${(data.treasurySol ?? 0).toFixed(4)} SOL, not enough to claim. Lifetime: ${(data.totalClaimed ?? 0).toFixed(2)} SOL claimed total, ${(data.totalBurned ?? 0).toFixed(0)} tokens burned total.`;
    }
    else {
        context = `This cycle: claimed ${(data.claimed ?? 0).toFixed(4)} SOL from creator vault, spent ${(data.boughtBackSol ?? 0).toFixed(4)} SOL on buyback via AMM, burned ${burnedStr} tokens${lpStr}. Lifetime: ${(data.totalClaimed ?? 0).toFixed(2)} SOL claimed, ${(data.totalBurned ?? 0).toFixed(0)} tokens burned, ${(data.totalBoughtBack ?? 0).toFixed(2)} SOL bought back total.`;
    }
    try {
        const res = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: context },
            ],
            max_tokens: 100,
            temperature: 0.95,
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
