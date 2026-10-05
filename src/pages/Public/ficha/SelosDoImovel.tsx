import type { Selo } from './fichaDoImovel';
import { ESTILO_SELO_DESTAQUE } from '../portalShared';

/**
 * Selos logo abaixo do título ("Muito procurado", financiamento, FGTS, MCMV).
 * O de destaque (Muito procurado) vai na cor de destaque da Aparência, com o
 * texto branco ou escuro pelo contraste.
 */
export default function SelosDoImovel({ selos }: { selos: Selo[] }) {
  if (selos.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {selos.map(s => (
        <li
          key={s.texto}
          className={s.destaque
            ? 'rounded-full px-3 py-1 text-[12px] font-semibold'
            : 'rounded-full bg-white px-3 py-1 text-[12px] font-medium text-neutral-700 ring-1 ring-black/[0.08]'}
          style={s.destaque ? ESTILO_SELO_DESTAQUE : undefined}
        >
          {s.texto}
        </li>
      ))}
    </ul>
  );
}
