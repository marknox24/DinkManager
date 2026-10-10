-- Indexes for the columns the app filters/joins on most. Postgres does not
-- index foreign keys automatically, so without these every lookup below is a
-- full table scan — the main CPU cost on a small instance.
-- Safe to run repeatedly (IF NOT EXISTS) and on a live database: the tables
-- are small, so each index builds in well under a second.

create index if not exists categories_event_idx      on categories    (event_id);
create index if not exists brackets_category_idx     on brackets      (category_id);
create index if not exists teams_bracket_idx         on teams         (bracket_id);
create index if not exists teams_registration_idx    on teams         (registration_id);
create index if not exists matches_bracket_idx       on matches       (bracket_id);
create index if not exists matches_status_idx        on matches       (status) where status = 'in_progress';
create index if not exists registrations_event_idx   on registrations (event_id);
create index if not exists registrations_category_idx on registrations (category_id);
create index if not exists registrations_player_idx  on registrations (player_id);
create index if not exists events_published_idx      on events        (is_published, visibility);

analyze categories;
analyze brackets;
analyze teams;
analyze matches;
analyze registrations;
analyze events;
