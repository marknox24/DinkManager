import { Link, useLocation } from 'react-router-dom';
import { Gauge, LifeBuoy, Users } from 'lucide-react';

// A stand-in for a real admin sidebar (Phase 2) — just enough to move
// between the three admin pages without going back through /dashboard.
const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: Gauge },
  { to: '/admin/customers', label: 'Customers & payments', icon: Users },
  { to: '/admin/support-requests', label: 'Support requests', icon: LifeBuoy },
];

export default function AdminNavLinks() {
  const { pathname } = useLocation();
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {LINKS.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              active ? 'bg-ink-900 text-white' : 'border border-ink-200 text-ink-600 hover:bg-ink-50'
            }`}
          >
            <Icon size={12} /> {label}
          </Link>
        );
      })}
    </div>
  );
}
