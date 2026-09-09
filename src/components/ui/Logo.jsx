// The DinkManager mark — three diagonal "pulse" bars in the brand palette.
// Colors are fixed brand hex values (not theme tokens): a logo shouldn't
// shift with the app's theme any more than a real-world brand mark would.
export default function Logo({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="2" y="5" width="26" height="8" rx="4" fill="#6C5CE7" />
      <rect x="8" y="16" width="24" height="8" rx="4" fill="#17C3B2" />
      <rect x="14" y="27" width="20" height="8" rx="4" fill="#FF6B6B" />
    </svg>
  );
}
