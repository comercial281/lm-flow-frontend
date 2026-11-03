// Um quadro da página de agentes: o cartão da casa (CartaoDeLink) com o resumo do agente.
import type { ResumoDoAgente, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import CartaoDeLink from '@/pages/Customer/Settings/Integrations/CartaoDeLink';
import { quadroDoAgente } from '@/features/salesAgents/quadroDoAgente';
import { situacaoDaIa } from '@/features/salesAgents/situacao';
import { paramsDaIa } from '@/features/salesAgents/iaMenu';
import SeloSituacao from '../SeloSituacao';

export default function QuadroDoAgente({ agent, resumo }: { agent: SalesAgent; resumo: ResumoDoAgente | null }) {
  const q = quadroDoAgente(agent, resumo);
  // Sem `pagina`: o Configurar abre na primeira página com pendência.
  const para = `/ia-vendedora?${new URLSearchParams(paramsDaIa(agent.id, 'configurar'))}`;
  const linhas: [string, string][] = [
    ['Modo operante', q.modo], ['Quem fala', q.quemFala], ['Próximo passo', q.proximoPasso], ['Produto', q.produto],
  ];
  return (
    <CartaoDeLink para={para}>
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {q.iniciais}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">{agent.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{q.numeros}</span>
          </span>
        </span>
        <SeloSituacao compacto situacao={situacaoDaIa(agent, null)} />
      </span>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="contents">
            <dt className="text-muted-foreground">{rotulo}</dt>
            <dd className="text-foreground">{valor}</dd>
          </div>
        ))}
      </dl>
      {(q.rodape || q.pendencia) && (
        <span className="flex flex-wrap gap-2 border-t pt-3 text-xs">
          {q.rodape && <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">{q.rodape}</span>}
          {q.pendencia && (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-amber-700 dark:text-amber-400">Falta: {q.pendencia}</span>
          )}
        </span>
      )}
    </CartaoDeLink>
  );
}
