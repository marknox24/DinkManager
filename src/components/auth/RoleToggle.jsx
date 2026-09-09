import { useNavigate } from 'react-router-dom';

// Pure navigation control — organizer/player each have their own route
// (lowest risk to the existing working auth flow), this just switches
// between them with a segmented-pill look instead of a plain text link.
export default function RoleToggle({ value, mode = 'login' }) {
  const navigate = useNavigate();
  const targets =
    mode === 'login' ? { organizer: '/login', player: '/player/login' } : { organizer: '/signup', player: '/player/signup' };

  return (
    <div className="mb-6 inline-flex w-full rounded-full bg-ink-100 p-1">
      {[
        { key: 'organizer', label: 'Organizer' },
        { key: 'player', label: 'Player' },
      ].map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => value !== opt.key && navigate(targets[opt.key])}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition ${
            value === opt.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
