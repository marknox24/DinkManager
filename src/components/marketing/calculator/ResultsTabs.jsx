import { useState } from 'react';
import Select from '../../ui/Select';
import { inputClass } from '../../ui/FormField';
import OverviewTab from './OverviewTab';
import CourtTimelineTab from './CourtTimelineTab';
import MatchListTab from './MatchListTab';
import TeamScheduleTab from './TeamScheduleTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'courts', label: 'Court Timeline' },
  { key: 'matches', label: 'Match List' },
  { key: 'teams', label: 'Team Schedule' },
];

export default function ResultsTabs({ result }) {
  const [tab, setTab] = useState('overview');
  const [bracketFilter, setBracketFilter] = useState('all');
  const [courtFilter, setCourtFilter] = useState('all');
  const showFilters = tab === 'courts' || tab === 'matches';

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Calculator results" className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`press-scale rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                tab === t.key ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {showFilters && (
          <div className="flex gap-2">
            <Select value={bracketFilter} onChange={(e) => setBracketFilter(e.target.value)} className={`${inputClass} w-auto`} dense aria-label="Filter by category">
              <option value="all">All categories</option>
              {result.brackets.map((b) => (
                <option key={b.bracketId} value={b.bracketId}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)} className={`${inputClass} w-auto`} dense aria-label="Filter by court">
              <option value="all">All courts</option>
              {Array.from({ length: result.summary.courtCount }, (_, i) => i + 1).map((c) => (
                <option key={c} value={String(c)}>
                  Court {c}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div key={tab} className="animate-fade-in">
        {tab === 'overview' && <OverviewTab result={result} />}
        {tab === 'courts' && <CourtTimelineTab result={result} bracketFilter={bracketFilter} courtFilter={courtFilter} />}
        {tab === 'matches' && <MatchListTab result={result} bracketFilter={bracketFilter} courtFilter={courtFilter} />}
        {tab === 'teams' && <TeamScheduleTab result={result} />}
      </div>
    </div>
  );
}
