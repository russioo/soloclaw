-- Kør i Supabase SQL Editor

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
  updated_at timestamptz default now(),
  last_run_at timestamptz
);

-- RLS: læsning for alle (anon), skrivning via service_role (bypasser RLS)
alter table agent_stats enable row level security;

drop policy if exists "Allow public read" on agent_stats;
create policy "Allow public read" on agent_stats for select using (true);
