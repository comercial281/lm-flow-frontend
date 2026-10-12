import { Home } from 'lucide-react';
import type { Balde } from './tipos';

/** Valor fixo do filtro de categoria: não é opção das Listas da casa (f2-07). */
export const CATEGORIA_IMOVEL = '__imovel_desatualizado';

type BaldeDeImovel = Exclude<Balde, 'concluidas'>;

// [singular, plural, período]
const TEXTOS: Record<BaldeDeImovel, [string, string, string]> = {
  para_fazer: ['imóvel desatualizado', 'imóveis desatualizados', 'vencidos até hoje'],
  atrasadas: ['imóvel desatualizado', 'imóveis desatualizados', 'venceram antes de hoje'],
  hoje: ['imóvel vence hoje', 'imóveis vencem hoje', 'completam o prazo hoje'],
  amanha: ['imóvel vence amanhã', 'imóveis vencem amanhã', 'completam o prazo amanhã'],
  semana: ['imóvel vence esta semana', 'imóveis vencem esta semana', 'completam o prazo nesta semana'],
  proxima_semana: ['imóvel vence semana que vem', 'imóveis vencem semana que vem', 'completam o prazo na semana que vem'],
};

export function textoDosImoveis(balde: Balde, n: number): { titulo: string; periodo: string } {
  const [um, varios, periodo] = TEXTOS[balde as BaldeDeImovel] ?? TEXTOS.para_fazer;
  return { titulo: `${n} ${n === 1 ? um : varios}`, periodo };
}

/**
 * Imóveis desatualizados em Atividades (f2-07, 11/10/2026): uma linha por aba,
 * sem caixinha. Some quando os imóveis são atualizados ou marcados "Está em dia".
 */
export default function LinhaDosImoveis({ balde, quantidade, deQuem, aoAbrir }: {
  balde: Balde; quantidade: number; deQuem: string; aoAbrir: () => void;
}) {
  const { titulo, periodo } = textoDosImoveis(balde, quantidade);
  const vencida = balde === 'atrasadas' || balde === 'para_fazer';
  return (
    <li className="-mx-4 flex items-start gap-2 bg-gradient-to-r from-accent to-transparent px-4 py-2 text-sm">
      <Home className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" aria-hidden />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={aoAbrir}>
        <p className="truncate font-medium hover:underline">{titulo}</p>
        <p className="truncate text-xs text-muted-foreground">
          {['Imóvel desatualizado', periodo, deQuem].join(' · ')}
          {vencida && <span className="ml-1 font-semibold text-destructive">Atrasada</span>}
        </p>
      </button>
      <span className="hidden shrink-0 self-center text-xs font-semibold text-accent-foreground sm:inline" aria-hidden>Ver imóveis →</span>
    </li>
  );
}
