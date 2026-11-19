export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-serif text-lg tracking-tight ${light ? "text-sand" : "text-ink"}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={light ? "#134e4a" : "#083432"} />
        <path d="M16 6c3.6 4.4 6.2 7.2 6.2 10.6a6.2 6.2 0 1 1-12.4 0C9.8 13.2 12.4 10.4 16 6z" fill="#8fd9cf" />
        <path d="M8 16.2h16" stroke="#f4f1ea" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      ThirstCap
    </span>
  );
}
