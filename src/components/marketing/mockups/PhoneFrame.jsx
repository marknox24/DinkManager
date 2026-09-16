// A restrained device frame — rounded shell, notch, side buttons — so the
// player-experience mockups read as "a phone" without looking like clipart.
export default function PhoneFrame({ children, className = '' }) {
  return (
    <div className={`relative mx-auto w-[280px] rounded-[2.75rem] border-[10px] border-ink-950 bg-ink-950 shadow-[0_40px_80px_-20px_rgba(17,23,31,0.45)] ${className}`}>
      <div className="absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-ink-950" />
      <div className="relative h-[560px] overflow-hidden rounded-[2.15rem] bg-white">{children}</div>
    </div>
  );
}
