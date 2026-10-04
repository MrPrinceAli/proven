/** Proven-ID mark (logo option 9, "Node P"): a P whose bowl carries a verified node. */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center bg-brand-700 shadow-sm ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <svg viewBox="0 0 64 64" width={size * 0.68} height={size * 0.68}>
        <path d="M16 30 V56" fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" />
        <circle cx="32" cy="28" r="16" fill="none" stroke="#fff" strokeWidth={7} />
        <circle cx="43.3" cy="16.7" r="6.5" fill="#A7F3D0" stroke="#047857" strokeWidth={3} />
      </svg>
    </span>
  );
}
