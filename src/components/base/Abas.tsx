import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGuardaDeSaida } from '@/hooks/useAlteracoesNaoSalvas';

// ── ABAS DA CASA ─────────────────────────────────────────────────────────────
//
// Regra (Fase 3, GLOSSARIO.md): um desenho só (sublinhado, ícone opcional), o
// nome da aba igual ao título do que ela abre, e NO MÁXIMO UM NÍVEL — o que
// hoje é aba dentro de aba vira seção quando a fase 4 passar pela tela.
//
// Dois jeitos de usar, mesmo desenho:
//   - aba que é LINK (cada aba é uma rota): passe `para` em todas. Clicar com
//     alteração não salva pergunta antes (é saída da tela).
//   - aba de ESTADO (troca o conteúdo sem mudar a rota): passe `ativa` e `aoTrocar`.
//
// Não usa o Tabs do kit (@evoapi/design-system): ele desenha pílula e não
// serve pra aba que é link.

export interface Aba {
  chave: string;
  rotulo: string;
  icone?: LucideIcon;
  /** Rota. Com `para` em todas as abas, a faixa vira navegação. */
  para?: string;
  /** A aba só fica ativa no endereço exato (quando o endereço dela é começo do de outra aba). */
  exata?: boolean;
  /** Bolinha vermelha de novidade ao lado do nome (ex.: captação nova chegou). */
  marcador?: boolean;
}

export interface AbasProps {
  abas: Aba[];
  /** Nome da faixa pra leitor de tela: "Setores de Automações". */
  rotulo: string;
  ativa?: string;
  aoTrocar?: (chave: string) => void;
  className?: string;
}

const Marcador = () => (
  <span role="img" aria-label="Novidade" data-marcador className="ml-1.5 inline-block h-2 w-2 rounded-full bg-destructive" />
);

const classeDaAba = (ativa: boolean) =>
  cn(
    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
    ativa ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
  );

export default function Abas({ abas, rotulo, ativa, aoTrocar, className }: AbasProps) {
  const { aoClicar, dialogoDeConfirmacao } = useGuardaDeSaida();
  const saoLinks = abas.length > 0 && abas.every(a => a.para);

  if (saoLinks) {
    return (
      <nav aria-label={rotulo} onClickCapture={aoClicar} className={cn('flex items-center gap-1 overflow-x-auto', className)}>
        {abas.map(({ chave, rotulo: nome, icone: Icone, para, exata, marcador }) => (
          <NavLink key={chave} to={para!} end={exata} className={({ isActive }) => classeDaAba(isActive)}>
            {Icone && <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            {nome}
            {marcador && <Marcador />}
          </NavLink>
        ))}
        {dialogoDeConfirmacao}
      </nav>
    );
  }

  return (
    <div role="tablist" aria-label={rotulo} className={cn('flex items-center gap-1 overflow-x-auto border-b border-border', className)}>
      {abas.map(({ chave, rotulo: nome, icone: Icone, marcador }) => (
        <button
          key={chave}
          type="button"
          role="tab"
          aria-selected={chave === ativa}
          onClick={() => aoTrocar?.(chave)}
          className={classeDaAba(chave === ativa)}
        >
          {Icone && <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          {nome}
          {marcador && <Marcador />}
        </button>
      ))}
    </div>
  );
}
