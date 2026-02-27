# Burn-sikkerhed: Vi brænder KUN lige købte tokens

## Flow (kort)

1. Claim fees (SOL) fra creator vault
2. 80% → CREATOR_WALLET
3. 20% → buyback (og evt. LP)
4. Burn **kun** det vi lige købte

---

## Detaljeret flow: doBuyback()

```
TRIN 1: balanceBefore = antal tokens agent allerede har
        (inkl. tokens du holdt FØR boten startede)

TRIN 2: Køb tokens med treasury-SOL (buyback)

TRIN 3: balanceAfter = antal tokens agent har nu

TRIN 4: boughtAmount = balanceAfter - balanceBefore
        = KUN de tokens vi lige købte

TRIN 5: Burn boughtAmount (aldrig balanceBefore)
```

**Eksempel:**
- Du har 10.000 tokens i agent-wallet (købt manuelt før bot)
- balanceBefore = 10.000
- Buyback køber 500 tokens
- balanceAfter = 10.500
- boughtAmount = 500
- Vi brænder 500 (ikke 10.500)
- Dine 10.000 er uændrede ✓

---

## Kode (agent/src/run.ts, linje 119-178)

```typescript
// FØR buy
const balanceBefore = await getTokenBalance(connection, agentTokenAta);

// Buy
// ... buyback transaktion ...

// EFTER buy
const balanceAfter = await getTokenBalance(connection, agentTokenAta);
const boughtAmount = BigInt(Math.max(0, Number(balanceAfter) - Number(balanceBefore)));

// Burn KUN boughtAmount
if (boughtAmount > BigInt(0)) {
  const burnIx = createBurnInstruction(..., boughtAmount, ...);
  // ...
}
```

---

## Edge cases

| Scenario | Resultat |
|----------|----------|
| Agent har 0 tokens før | balanceBefore=0, burn = alt vi købte ✓ |
| Agent har 1000 fra før | balanceBefore=1000, burn = kun ny køb ✓ |
| Buy returnerer 0 tokens | boughtAmount=0, ingen burn ✓ |
| ATA findes ikke | getTokenBalance returnerer 0 ✓ |

---

## Bekræftelse

Begge implementationer (agent/ og website/lib/agent-cycle.ts) bruger samme logik:
- balanceBefore
- buy
- balanceAfter
- burn(balanceAfter - balanceBefore)

**Dine tokens fra før boten er sikre.**
