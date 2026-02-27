/**
 * Simpel fake agent – kører en cyklus hver 3. minut (eller 3 sek i demo).
 * Hver cyklus: claim → 80% til creator (usynlig) → 20% til treasury → buyback/burn/LP
 */

export const CYCLE_INTERVAL_MS = 3000; // 3 sek i demo (brug 180000 for 3 min)

const CREATOR_SHARE = 0.8;
const TREASURY_SHARE = 0.2;

const TOKEN_PRICE = 0.000012;

/** Simuleret fees per claim – lidt tilfældig */
function getClaimAmount(cycleIndex: number): number {
  const base = 0.3 + (cycleIndex * 0.02);
  const variance = 0.9 + (cycleIndex % 5) * 0.03;
  return Math.round((base * variance) * 100) / 100;
}

export type CycleAction =
  | { type: "claim"; totalSol: number; toTreasury: number }
  | { type: "buyback"; sol: number; tokens: number }
  | { type: "burn"; tokens: number }
  | { type: "addLP"; sol: number };

export type CycleResult = {
  actions: CycleAction[];
  thought: string;
};

/**
 * Fordeler treasury mellem buyback og LP. LP kun når migrated – ellers fuld buyback.
 * Varierer fra cyklus til cyklus: nogle gange mere buyback, nogle gange LP, nogle begge.
 */
function getAllocation(cycleIndex: number, isMigrated: boolean): { buyback: number; lp: number } {
  if (!isMigrated) return { buyback: 1, lp: 0 };

  const variants = [
    { buyback: 0.7, lp: 0.3 },
    { buyback: 0.9, lp: 0.1 },
    { buyback: 0.5, lp: 0.5 },
    { buyback: 1, lp: 0 },
    { buyback: 0.6, lp: 0.4 },
  ];
  const v = variants[cycleIndex % variants.length];
  return v;
}

/**
 * Kører én cyklus. Returnerer handlinger + auto-genereret thought.
 */
export function runCycle(cycleIndex: number, isMigrated: boolean): CycleResult {
  const totalClaimed = getClaimAmount(cycleIndex);
  const toTreasury = Math.round(totalClaimed * TREASURY_SHARE * 100) / 100;

  const actions: CycleAction[] = [];
  actions.push({ type: "claim", totalSol: totalClaimed, toTreasury });

  const { buyback: buybackFrac, lp: lpFrac } = getAllocation(cycleIndex, isMigrated);

  const buybackSol = Math.round(toTreasury * buybackFrac * 100) / 100;
  const lpSol = Math.round(toTreasury * lpFrac * 100) / 100;

  if (buybackSol > 0) {
    const tokens = Math.floor(buybackSol / TOKEN_PRICE);
    actions.push({ type: "buyback", sol: buybackSol, tokens });
    actions.push({ type: "burn", tokens });
  }

  if (lpSol > 0 && isMigrated) {
    actions.push({ type: "addLP", sol: lpSol });
  }

  let thought = `Claimed fees. ${toTreasury.toFixed(2)} SOL to treasury.`;
  if (buybackSol > 0) {
    const tokens = Math.floor(buybackSol / TOKEN_PRICE);
    thought += ` Bought back ${tokens.toLocaleString()} tokens. Burning.`;
  }
  if (lpSol > 0 && isMigrated) {
    thought += ` Added ${lpSol.toFixed(2)} SOL to LP.`;
  }

  return { actions, thought };
}

/** Første X cykler = ikke migrated. Derefter migrated. */
export const MIGRATED_AFTER_CYCLE = 3;
