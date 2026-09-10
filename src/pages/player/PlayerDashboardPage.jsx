import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Trophy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getMyBracketResults, listMyRegistrations } from '../../data/playerApi';
import PlayerLayout from '../../components/player/PlayerLayout';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-brand-100 text-brand-700',
  denied: 'bg-rose-100 text-rose-600',
  waitlisted: 'bg-violet-100 text-violet-700',
};

function teamLabel(reg) {
  return reg.player2_name ? `${reg.player_name} & ${reg.player2_name}` : reg.player_name;
}

export default function PlayerDashboardPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [registrations, setRegistrations] = useState(null);
  const [bracketResults, setBracketResults] = useState({});

  useEffect(() => {
    listMyRegistrations(user.id)
      .then(async (regs) => {
        setRegistrations(regs);
        const results = await getMyBracketResults(regs.map((r) => r.id));
        setBracketResults(results);
      })
      .catch((e) => pushToast(e.message, 'error'));
  }, [user.id, pushToast]);

  return (
    <PlayerLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-900">Your registrations</h1>
        <p className="text-sm text-ink-500">Track your tournament status and bracket results</p>
      </div>

      {registrations === null && <div className="py-16 text-center text-sm text-ink-400">Loading your registrations…</div>}

      {registrations && registrations.length === 0 && (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white py-16 text-center">
          <p className="text-sm text-ink-500">You haven't registered for any events yet.</p>
        </div>
      )}

      {registrations && registrations.length > 0 && (
        <div className="flex flex-col gap-3">
          {registrations.map((reg) => {
            const result = bracketResults[reg.id];
            return (
              <div key={reg.id} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {reg.events?.slug ? (
                      <Link to={`/e/${reg.events.slug}`} className="font-display text-base font-bold text-ink-900 hover:text-brand-600">
                        {reg.events?.name || 'Event'}
                      </Link>
                    ) : (
                      <span className="font-display text-base font-bold text-ink-900">{reg.events?.name || 'Event'}</span>
                    )}
                    <div className="mt-0.5 text-xs text-ink-500">{reg.categories?.name || 'Category'}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[reg.status]}`}>{reg.status}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={13} /> {teamLabel(reg)}
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-ink-600">
                    <Trophy size={13} className={result ? 'text-brand-600' : 'text-ink-300'} />
                    {result ? `Bracket ${result.letter} · ${result.wins}-${result.losses}` : 'Bracket not yet drawn'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PlayerLayout>
  );
}
