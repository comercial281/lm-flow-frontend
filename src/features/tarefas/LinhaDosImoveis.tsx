import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    <li className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm transition-colors hover:bg-muted/60">
      {/* Sem bolinha (não se conclui daqui), mas com o lugar dela: alinha com as tarefas. */}
      <span className="size-5 shrink-0" aria-hidden />
      <span
        className={cn('grid size-8 shrink-0 place-items-center rounded-[10px] sm:size-9', vencida ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground')}
        aria-hidden
      >
        <Home className="h-4 w-4" />
      </span>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={aoAbrir}>
        <span className="block truncate font-semibold hover:underline">{titulo}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{['Imóvel desatualizado', periodo, deQuem].join(' · ')}</span>
      </button>
      {vencida && <span className="shrink-0 whitespace-nowrap rounded-full bg-destructive/10 px-2 py-px text-[11px] font-medium text-destructive">Atrasada</span>}
      {/* No lugar do menu das tarefas, pra direita ficar alinhada. */}
      <ChevronRight className="mx-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </li>
  );
}
