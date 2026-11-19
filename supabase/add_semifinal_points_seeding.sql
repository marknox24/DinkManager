-- Run once in the Supabase SQL editor, BEFORE deploying the frontend that
-- ships with it: Event Details saves these columns with every category edit,
-- so if the frontend goes first, saving any category fails until this has
-- run. Safe to re-run. Existing categories default to 'crossover', so their
-- semifinals are unchanged. Mirrors the PLAYOFF PLAN section of schema.sql.
begin;

-- Semifinal matchups, used by any ladder that has a semifinal round:
-- 'crossover' (pool pairs as above, or bracket order when the semifinals
-- follow an earlier knockout round) or 'points' (the four semifinalists, the
-- qualifiers or the previous round's winners, reseeded by round-robin point
-- differential, ignoring wins and losses; see the POINTS-SYSTEM section of
-- src/utils/playoffLadder.js). Who qualifies is the same either way. The
-- Match List asks to confirm it (and can override it for that one
-- generation) every time the semifinals are generated. Pairing '1v4' = 1 vs 4 and 2 vs 3, '1v2' = 1 vs 2 and
-- 3 vs 4, '1v3' = 1 vs 3 and 2 vs 4. Metric 'total' = raw differential,
-- 'average' = per game played, so smaller pools aren't disadvantaged.
alter table categories add column if not exists playoff_semifinal_seeding text not null default 'crossover';
alter table categories add column if not exists playoff_semifinal_pairing text not null default '1v4';
alter table categories add column if not exists playoff_points_metric text not null default 'total';
alter table categories drop constraint if exists categories_playoff_semifinal_seeding_check;
alter table categories add constraint categories_playoff_semifinal_seeding_check check (playoff_semifinal_seeding in ('crossover', 'points'));
alter table categories drop constraint if exists categories_playoff_semifinal_pairing_check;
alter table categories add constraint categories_playoff_semifinal_pairing_check check (playoff_semifinal_pairing in ('1v4', '1v2', '1v3'));
alter table categories drop constraint if exists categories_playoff_points_metric_check;
alter table categories add constraint categories_playoff_points_metric_check check (playoff_points_metric in ('total', 'average'));

commit;
