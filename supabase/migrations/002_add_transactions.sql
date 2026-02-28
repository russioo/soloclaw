-- Tilføj transactions kolonne til agent_stats
alter table agent_stats add column if not exists transactions jsonb default '[]';
