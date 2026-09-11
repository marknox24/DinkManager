// Single source of truth for event-staff permission toggles — consumed by
// the toggle UI (StaffPermissionToggles) and the nav filter
// (EventWorkspaceLayout) so the two can't drift apart. Column names and
// defaults mirror the event_staff table in supabase/schema.sql exactly.
export const EVENT_PERMISSIONS = [
  {
    key: 'overview',
    column: 'can_overview',
    navId: 'overview',
    enforcement: 'ui',
    label: 'Overview',
    description: 'See the event dashboard and summary stats.',
  },
  {
    key: 'registrations',
    column: 'can_registrations',
    navId: 'manage',
    enforcement: 'db',
    label: 'Registrations',
    description: 'View, approve, deny, and edit player registrations.',
  },
  {
    key: 'checkin',
    column: 'can_checkin',
    navId: 'checkin',
    enforcement: 'db',
    label: 'Check-in',
    description: 'Check players in and out on event day.',
  },
  {
    key: 'brackets',
    column: 'can_brackets',
    navId: 'brackets',
    enforcement: 'db',
    label: 'Brackets & scoring',
    description: 'View brackets, start matches, and record scores.',
  },
  {
    key: 'redraw_brackets',
    column: 'can_redraw_brackets',
    navId: null,
    sub: 'brackets',
    enforcement: 'db',
    label: 'Redraw brackets',
    description: 'Re-run the randomizer, wiping existing brackets and standings.',
  },
  {
    key: 'matchlist',
    column: 'can_matchlist',
    navId: 'matchlist',
    // Not view-only despite the nav label — the underlying matches_owner_all
    // RLS policy grants full write (score, delete, generate later playoff
    // stages) to anyone with this toggle, same as 'brackets'. Documented
    // here rather than restricted at the DB layer, since Match List's own
    // Start/Log-score actions rely on that write access to function.
    enforcement: 'db',
    label: 'Match list',
    description: 'View the schedule, and start/score matches from this page.',
  },
  {
    key: 'preview',
    column: 'can_preview',
    navId: 'preview',
    enforcement: 'ui',
    label: 'Preview screen',
    description: 'Set up and open the venue TV display.',
  },
  {
    key: 'umpires',
    column: 'can_umpires',
    navId: 'umpires',
    enforcement: 'db',
    label: 'Umpires',
    description: 'Add, edit, and remove umpires.',
  },
  {
    key: 'sponsors',
    column: 'can_sponsors',
    navId: 'sponsors',
    enforcement: 'db',
    label: 'Sponsors',
    description: 'Manage sponsor logos and tiers. Logos still show on Preview either way.',
  },
  {
    key: 'accounting',
    column: 'can_accounting',
    navId: 'accounting',
    enforcement: 'db',
    label: 'Accounting',
    description: 'View and manage expenses, earnings, and receipts.',
  },
  {
    key: 'settings',
    column: 'can_settings',
    navId: 'settings',
    enforcement: 'db',
    label: 'Settings',
    description: 'Change event settings such as courts and currency.',
  },
  {
    key: 'edit_event',
    column: 'can_edit_event',
    navId: null,
    enforcement: 'db',
    label: 'Edit event details',
    description: 'Edit categories, logistics, media, and publish status.',
  },
];

export const PERMISSION_COLUMNS = EVENT_PERMISSIONS.map((p) => p.column);

export const DEFAULT_PERMISSIONS = {
  can_overview: true,
  can_registrations: true,
  can_checkin: true,
  can_brackets: true,
  can_redraw_brackets: false,
  can_matchlist: true,
  can_preview: true,
  can_umpires: true,
  can_sponsors: false,
  can_accounting: false,
  can_settings: false,
  can_edit_event: false,
};

export function permissionForNavId(navId) {
  return EVENT_PERMISSIONS.find((p) => p.navId === navId)?.key;
}
