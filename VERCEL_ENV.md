# Vercel Environment Variables

Kopier disse ind i Vercel → dit projekt → Settings → Environment Variables.

---

## PÅKRÆVET

| Name | Value | Beskrivelse |
|------|-------|-------------|
| `NEXT_PUBLIC_CREATOR_ADDRESS` | `din_wallet_adresse` | Creator/agent wallet (public) |
| `NEXT_PUBLIC_MINT_ADDRESS` | `token_mint` | Token mint fra pump.fun |
| `AGENT_PRIVATE_KEY` | `base58_secret` | Din wallet secret key – HEMMELIG |
| `CREATOR_WALLET` | `din_wallet` | Hvor 80% af fees går |
| `MINT_ADDRESS` | `token_mint` | Samme som NEXT_PUBLIC_MINT_ADDRESS |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Fra Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Fra Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Fra Supabase → Settings → API (service_role) – HEMMELIG |

---

## VALGFRIT

| Name | Value | Beskrivelse |
|------|-------|-------------|
| `RPC_URL` | `https://api.mainnet-beta.solana.com` | Eller Helius/QuickNode |
| `NEXT_PUBLIC_RPC_URL` | samme som RPC_URL | |
| `CRON_SECRET` | `et_tilfældigt_password` | Sikrer cron-endpoint (Vercel kan sætte automatisk) |
| `MIN_CLAIM_SOL` | `0.01` | Min SOL før agent claimer |

---

## Kopier-klar liste (kun navne)

```
NEXT_PUBLIC_CREATOR_ADDRESS
NEXT_PUBLIC_MINT_ADDRESS
AGENT_PRIVATE_KEY
CREATOR_WALLET
MINT_ADDRESS
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```
