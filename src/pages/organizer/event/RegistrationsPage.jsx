import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, CheckCircle2, FileSpreadsheet, ImageIcon, Pencil, QrCode, Shuffle, Trash2, Trophy, UserPlus, XCircle } from 'lucide-react';
import {
  createRegistration,
  createRegistrationsBulk,
  deleteRegistration,
  getEventById,
  getRegistrationFileUrl,
  listActivity,
  listCategories,
  listRegistrations,
  updateRegistration,
  updateRegistrationStatus,
} from '../../../data/eventsApi';
import { getBracketAssignmentsForEvent } from '../../../data/bracketsApi';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import EventWorkspaceLayout from '../../../components/organizer/EventWorkspaceLayout';
import EditRegistrationModal from '../../../components/organizer/EditRegistrationModal';
import AddPlayerModal from '../../../components/organizer/AddPlayerModal';
import ImportPlayersModal from '../../../components/organizer/ImportPlayersModal';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-brand-100 text-brand-700',
  denied: 'bg-rose-100 text-rose-600',
  waitlisted: 'bg-violet-100 text-violet-700',
};

// Event-day check-in badge — only shown once at least one slot has checked
// in, so a normal not-yet-checked-in row doesn't get an extra pill next to
// the approval status. Manual check-in itself now lives on its own tab.
function checkinBadge(r) {
  const p1 = Boolean(r.player1_checked_in_at);
  const p2 = Boolean(r.player2_checked_in_at);
  if (r.player2_name) {
    if (p1 && p2) return { label: 'Both checked in', className: 'bg-brand-100 text-brand-700' };
    if (p1 || p2) return { label: '1/2 checked in', className: 'bg-amber-100 text-amber-800' };
    return null;
  }
  return p1 ? { label: 'Checked in', className: 'bg-brand-100 text-brand-700' } : null;
}

export default function RegistrationsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const confirm = useConfirm();

  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [activity, setActivity] = useState([]);
  const [editingReg, setEditingReg] = useState(null);
  const [bracketAssignments, setBracketAssignments] = useState({});
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [ev, cats, regs, act] = await Promise.all([getEventById(eventId), listCategories(eventId), listRegistrations(eventId), listActivity(eventId)]);
      setEvent(ev);
      setCategories(cats);
      setRegistrations(regs);
      setActivity(act);
      const assignments = await getBracketAssignmentsForEvent(cats.map((c) => c.id));
      setBracketAssignments(assignments);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  }, [eventId, pushToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setStatus = async (reg, status) => {
    try {
      await updateRegistrationStatus(reg.id, status);
      setRegistrations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, status } : r)));
      const act = await listActivity(eventId);
      setActivity(act);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const removeRegistration = async (reg) => {
    const ok = await confirm({ title: `Remove ${reg.player_name}?`, message: 'This permanently deletes their registration — useful for accidental duplicates.', confirmLabel: 'Remove' });
    if (!ok) return;
    try {
      await deleteRegistration(reg.id);
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const viewPhoto = async (reg) => {
    try {
      const url = await getRegistrationFileUrl(reg.photo_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const saveEdit = async (patch) => {
    try {
      const moved = patch.category_id !== editingReg.category_id;
      const updated = await updateRegistration(editingReg.id, patch);
      setRegistrations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      pushToast(moved ? 'Registration updated and moved to the new category' : 'Registration updated', 'success');
      setEditingReg(null);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const handleAddPlayer = async (payload) => {
    try {
      await createRegistration({ event_id: eventId, ...payload });
      await reload();
    } catch (e) {
      pushToast(e.message, 'error');
      throw e;
    }
  };

  const handleImportPlayers = async (categoryId, rows) => {
    try {
      await createRegistrationsBulk(
        rows.map((r) => ({
          event_id: eventId,
          category_id: categoryId,
          player_name: r.player1,
          player2_name: r.player2 || null,
          club_name: r.club || null,
          player_email: r.email || null,
          phone: r.phone || null,
        }))
      );
      pushToast(`${rows.length} player${rows.length > 1 ? 's' : ''} imported`, 'success');
      await reload();
    } catch (e) {
      pushToast(e.message, 'error');
      throw e;
    }
  };

  return (
    <EventWorkspaceLayout eventName={event?.name}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Registrations</h1>
          <p className="text-sm text-ink-500">Approve players and follow activity for this event</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            disabled={categories.length === 0}
            className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-600 transition hover:bg-ink-100 disabled:opacity-50"
          >
            <FileSpreadsheet size={14} /> Import Excel
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            disabled={categories.length === 0}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            <UserPlus size={14} /> Add player
          </button>
        </div>
      </div>

      {!event ? (
        <div className="py-16 text-center text-sm text-ink-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            {categories.map((cat) => {
              const catRegs = registrations.filter((r) => r.category_id === cat.id);
              return (
                <div key={cat.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-ink-800">{cat.name}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-500 ring-1 ring-ink-200">
                        {catRegs.length}
                        {cat.max_slots ? ` / ${cat.max_slots}` : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/events/${eventId}/brackets`)}
                      className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[11px] font-bold text-brand-700 transition hover:bg-brand-100"
                    >
                      <Shuffle size={12} /> Randomizer
                    </button>
                  </div>
                  {catRegs.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-ink-400">No registrations yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead>
                          <tr className="border-b border-ink-100 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                            <th className="px-4 py-2.5 text-left">Player</th>
                            <th className="px-4 py-2.5 text-left">Club</th>
                            <th className="px-4 py-2.5 text-left">Status</th>
                            <th className="px-4 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catRegs.map((r) => (
                            <tr key={r.id} className="border-b border-ink-50">
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-ink-800">
                                  {r.player_name}
                                  {r.player2_name ? ` & ${r.player2_name}` : ''}
                                </div>
                                {(r.player_email || r.phone) && (
                                  <div className="text-xs text-ink-400">{[r.player_email, r.phone].filter(Boolean).join(' · ')}</div>
                                )}
                                {r.address && <div className="text-xs text-ink-400">{r.address}</div>}
                              </td>
                              <td className="px-4 py-2.5 text-ink-600">{r.club_name || '—'}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                                  {bracketAssignments[r.id] && (
                                    <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                                      <Trophy size={10} /> Bracket {bracketAssignments[r.id]}
                                    </span>
                                  )}
                                  {checkinBadge(r) && (
                                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${checkinBadge(r).className}`}>
                                      <QrCode size={10} /> {checkinBadge(r).label}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex justify-end gap-1.5">
                                  {r.status !== 'approved' && (
                                    <button onClick={() => setStatus(r, 'approved')} title="Approve" className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100">
                                      <CheckCircle2 size={14} />
                                    </button>
                                  )}
                                  {r.status !== 'denied' && (
                                    <button
                                      onClick={() => setStatus(r, 'denied')}
                                      disabled={Boolean(bracketAssignments[r.id])}
                                      title={bracketAssignments[r.id] ? 'Already placed in a bracket — remove them from the bracket first' : 'Deny'}
                                      className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-50"
                                    >
                                      <XCircle size={14} />
                                    </button>
                                  )}
                                  {r.photo_path && (
                                    <button onClick={() => viewPhoto(r)} title="View photo" className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-violet-600 hover:bg-violet-100">
                                      <ImageIcon size={13} />
                                    </button>
                                  )}
                                  <button onClick={() => setEditingReg(r)} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100">
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => removeRegistration(r)}
                                    disabled={Boolean(bracketAssignments[r.id])}
                                    title={bracketAssignments[r.id] ? 'Already placed in a bracket — remove them from the bracket first' : 'Remove'}
                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-ink-500 hover:bg-ink-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink-100"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {categories.length === 0 && (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-12 text-center text-sm text-ink-400">
                Add categories in Edit event before players can register.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:h-fit">
            <div className="mb-3 flex items-center gap-2">
              <Activity size={15} className="text-ink-400" />
              <h3 className="font-display text-sm font-bold text-ink-800">Activity feed</h3>
            </div>
            <div className="flex max-h-[500px] flex-col gap-2.5 overflow-y-auto">
              {activity.length === 0 && <p className="text-xs text-ink-400">Nothing yet.</p>}
              {activity.map((a) => (
                <div key={a.id} className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  <div>{a.message}</div>
                  <div className="mt-0.5 text-[10px] text-ink-400">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingReg && (
        <EditRegistrationModal registration={editingReg} categories={categories} onSave={saveEdit} onClose={() => setEditingReg(null)} />
      )}

      {addModalOpen && (
        <AddPlayerModal categories={categories} onAdd={handleAddPlayer} onClose={() => setAddModalOpen(false)} />
      )}

      {importModalOpen && (
        <ImportPlayersModal categories={categories} onImport={handleImportPlayers} onClose={() => setImportModalOpen(false)} />
      )}
    </EventWorkspaceLayout>
  );
}
