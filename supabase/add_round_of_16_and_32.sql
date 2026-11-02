-- Run once in the Supabase SQL editor, BEFORE deploying the frontend that
-- ships with it: until this has run, generating a Round of 16 or Round of 32
-- fails on this constraint. Safe the other way round, and safe to re-run.
begin;

alter table matches drop constraint if exists matches_playoff_stage_check;
alter table matches add constraint matches_playoff_stage_check
  check (playoff_stage is null or playoff_stage in ('round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'));

commit;
