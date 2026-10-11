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
-- Registration triggers filter by (category, status) on every insert, and the
-- duplicate-player check compares lower(trim(player_name)).
create index if not exists registrations_category_status_idx on registrations (category_id, status);
create index if not exists registrations_player_name_idx on registrations (lower(trim(player_name)));
create index if not exists events_published_idx      on events        (is_published, visibility);

analyze categories;
analyze brackets;
analyze teams;
analyze matches;
analyze registrations;
analyze events;

-- sync_operations is append-only (one row per offline-sync write, kept to
-- detect a stale replay arriving after a device reconnects) and nothing
-- ever deletes old rows. Every score/start/finish action looks it up via
-- sync_operations_by_match, so a smaller table/index here is less for
-- Postgres to hold in memory on every single scoring action, not just a
-- one-time cleanup. 7 days is far longer than any realistic "device was
-- offline" window (see can_edit_match / sync_log_score in schema.sql).
-- Safe to run anytime; nothing reads a row this old.
delete from sync_operations where applied_at < now() - interval '7 days';
