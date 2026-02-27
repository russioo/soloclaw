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
| `AGENT_PRIVATE_KEY` | Din secret (base58) |
| `CREATOR_WALLET` | Hvor 80% går |
| `MINT_ADDRESS` | Samme som mint |
| `NEXT_PUBLIC_SUPABASE_URL` | Fra Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fra Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Fra Supabase (hemmelig) |

## 3. Deploy

```bash
cd website && npm run build
```

Push til GitHub → Vercel deployer automatisk. Cron kører hver 3. min.

---

**Flow:** Agent → claim/buyback/burn/LP → skriver til Supabase → website læser fra Supabase. Alle ser samme data.
