import type { Selo } from './fichaDoImovel';

/** Selos logo abaixo do título ("Muito procurado", financiamento, FGTS, MCMV). */
export default function SelosDoImovel({ selos }: { selos: Selo[] }) {
  if (selos.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {selos.map(s => (
        <li
          key={s.texto}
          className={s.destaque
            ? 'rounded-full px-3 py-1 text-[12px] font-semibold text-white'
            : 'rounded-full bg-white px-3 py-1 text-[12px] font-medium text-neutral-700 ring-1 ring-black/[0.08]'}
          style={s.destaque ? { background: 'var(--brand)' } : undefined}
        >
          {s.texto}
        </li>
      ))}
    </ul>
  );
}
