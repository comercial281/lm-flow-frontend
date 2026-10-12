export default function AnelDeProgresso({ feitas, total }: { feitas: number; total: number }) {
  const pct = total ? Math.round((feitas / total) * 100) : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
        <circle cx="23" cy="23" r={r} fill="none" className="stroke-muted" strokeWidth="5" />
        <circle cx="23" cy="23" r={r} fill="none" className="stroke-primary" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 23 23)" />
      </svg>
      <div>
        <p className="text-sm font-semibold">{feitas} de {total} aulas</p>
        <p className="text-xs text-muted-foreground">{pct}% concluído</p>
      </div>
    </div>
  );
}
