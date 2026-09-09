import AuthShowcasePanel from './AuthShowcasePanel';

// Shared shell for every auth screen: a floating white card split into the
// page's own form (left) and the brand showcase panel (right, hidden on
// small screens so mobile gets a clean single-column form).
export default function AuthSplitLayout({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] p-4">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10">{children}</div>
        <AuthShowcasePanel />
      </div>
    </div>
  );
}
