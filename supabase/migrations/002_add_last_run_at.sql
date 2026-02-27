-- Hvis du allerede har kørt 001, kør kun denne:
alter table agent_stats add column if not exists last_run_at timestamptz;
