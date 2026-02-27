# SoloClaw Agent

Kører hver 3 min. Bruger **Pump SDK** til claim + buyback, **PumpSwap SDK** til add LP (når migrated).

## Setup

```bash
cd agent
cp .env.example .env
# Udfyld AGENT_PRIVATE_KEY, CREATOR_WALLET, MINT_ADDRESS
npm install
```

## Kør manuelt

```bash
npm run build
npm run run
```

## Kør med interval (schedule)

```bash
npm run build
npm run schedule
# Eller: npm run dev  (build + schedule)
```

## Schedule i prod

Brug fx GitHub Actions eller system cron:

```yaml
# .github/workflows/agent.yml
on:
  schedule:
    - cron: '*/3 * * * *'  # Hver 3. minut
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd agent && npm ci && npm run run
        env:
          AGENT_PRIVATE_KEY: ${{ secrets.AGENT_PRIVATE_KEY }}
          CREATOR_WALLET: ${{ secrets.CREATOR_WALLET }}
          MINT_ADDRESS: ${{ secrets.MINT_ADDRESS }}
          RPC_URL: ${{ secrets.RPC_URL }}
```

## Flow

1. **Claim** – `sdk.collectCoinCreatorFeeInstructions(creator)`
2. **80%** – Transfer til CREATOR_WALLET
3. **20%** – Check `getMinimumDistributableFee(mint).isGraduated`
4. **Ikke migrated:** Buyback (Pump SDK `buyInstructions`) → Burn
5. **Migrated:** Buyback + Add LP (PumpSwap SDK `depositInstructions`)
