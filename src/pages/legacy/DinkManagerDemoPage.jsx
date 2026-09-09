import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TournamentProvider } from '../../context/TournamentContext';
import Sidebar from '../../components/layout/Sidebar';
import TopBar from '../../components/layout/TopBar';
import HistoryModal from '../../components/modals/HistoryModal';
import GlobalPresentation from '../../components/presentation/GlobalPresentation';
import OverviewPage from '../OverviewPage';
import TournamentPage from '../TournamentPage';
import UmpiresPage from '../UmpiresPage';
import SettingsPage from '../SettingsPage';

// Single-tournament, browser-only demo of the original bracket/court manager.
// Kept around at /demo/dinkmanager — its category/bracket/court logic will be
// reused as the per-event "Brackets" feature once the randomizer phase lands.
function Dashboard() {
  const [activeView, setActiveView] = useState('tournament');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [globalPreviewOpen, setGlobalPreviewOpen] = useState(false);

  const navigate = (view) => {
    setActiveView(view);
    setMobileNavOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-[#f3f6f8]">
      <Sidebar
        activeView={activeView}
        onNavigate={navigate}
        onOpenPresentation={() => setGlobalPreviewOpen(true)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[11px] font-semibold text-amber-800">
          Standalone demo — not connected to your Supabase events. <Link to="/dashboard" className="underline">Go to your dashboard</Link>
        </div>
        <TopBar activeView={activeView} onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6">
          {activeView === 'overview' && <OverviewPage />}
          {activeView === 'tournament' && <TournamentPage onOpenHistory={(ci, bi) => setHistoryTarget({ catIdx: ci, bracketIdx: bi })} />}
          {activeView === 'umpires' && <UmpiresPage />}
          {activeView === 'settings' && <SettingsPage />}
        </main>
      </div>

      <HistoryModal open={!!historyTarget} target={historyTarget} onClose={() => setHistoryTarget(null)} />
      {globalPreviewOpen && <GlobalPresentation onClose={() => setGlobalPreviewOpen(false)} />}
    </div>
  );
}

export default function DinkManagerDemoPage() {
  return (
    <TournamentProvider>
      <Dashboard />
    </TournamentProvider>
  );
}
