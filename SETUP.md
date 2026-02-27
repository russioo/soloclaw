# SoloClaw setup

## 1. Supabase

1. Opret projekt på [supabase.com](https://supabase.com)
2. Gå til SQL Editor og kør:

```sql
create table if not exists agent_stats (
  id text primary key default 'default',
  total_claimed numeric default 0,
  total_creator_share numeric default 0,
  total_burned numeric default 0,
  total_bought_back numeric default 0,
  total_lp_sol numeric default 0,
  treasury_sol numeric default 0,
  thought text default '',
  thought_meta text default '',
  feed_entries jsonb default '[]',
  last_run_at timestamptz,
  updated_at timestamptz default now()
);

alter table agent_stats enable row level security;
create policy "Allow public read" on agent_stats for select using (true);
```

3. Kopiér URL, anon key og service_role key fra Settings → API

## 2. Vercel env vars

Sæt i Vercel → Settings → Environment Variables:

| Variable | Beskrivelse |
|----------|-------------|
| `NEXT_PUBLIC_CREATOR_ADDRESS` | Din wallet |
| `NEXT_PUBLIC_MINT_ADDRESS` | Token mint |
| `CREATOR_WALLET` | Hvor 80% går |
| `MINT_ADDRESS` | Samme som mint |
| `NEXT_PUBLIC_SUPABASE_URL` | Fra Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fra Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Fra Supabase (hemmelig) |

**To måder at køre agenten:**

- **A) På Vercel** (private key hos Vercel): Tilføj `AGENT_PRIVATE_KEY` (base58).
- **B) Lokalt på din PC** (anbefalet – key bliver hjemme): Sæt `AGENT_BACKEND_URL` til din ngrok-URL (fx `https://abc123.ngrok-free.app`). Se afsnit 4.

## 3. Deploy

```bash
cd website && npm run build
```

Push til GitHub → Vercel deployer automatisk.

**Agent:** Kører automatisk når nogen besøger sitet – max 1x per 3 min. Ingen cron nødvendig. Virker på Hobby.

## 4. Agent lokalt (PC) + ngrok (hvis private key skal blive på din PC)

1. I `agent/`: `cp .env.example .env` og udfyld `AGENT_PRIVATE_KEY`, `CREATOR_WALLET`, `MINT_ADDRESS`.
2. Start agent-serveren:
   ```bash
   cd agent && npm run dev:server
   ```
3. I en anden terminal, start ngrok:
   ```bash
   npx ngrok http 3456
   ```
4. Kopiér ngrok-URL'en (fx `https://abc123.ngrok-free.app`) og sæt den som `AGENT_BACKEND_URL` i Vercel.
5. **VIGTIGT:** Gratis ngrok-URL'er ændres hver gang ngrok genstartes. Opdater `AGENT_BACKEND_URL` i Vercel efter hver restart.
6. Sørg for at Supabase env-vars er sat på Vercel – Vercel modtager resultatet fra din PC og skriver til Supabase.

**Flow:** Besøg → Vercel kalder din PC via ngrok → PC kører agent med private key → returnerer resultat → Vercel gemmer i Supabase.

### 429 Too Many Requests?
Gratis Solana RPC har lav rate limit. Brug fx [Helius](https://helius.dev) (gratis tier) eller QuickNode, og sæt `RPC_URL` + `NEXT_PUBLIC_RPC_URL` i Vercel.

---

**Flow:** Agent → claim/buyback/burn/LP → skriver til Supabase → website læser fra Supabase. Alle ser samme data.
