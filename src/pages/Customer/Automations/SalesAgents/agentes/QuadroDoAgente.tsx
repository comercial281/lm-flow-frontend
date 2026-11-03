// Um quadro da página de agentes (03/11/2026, pedido do dono, no molde dos cards de
// marketplace que ele trouxe): capa no topo com a situação no canto, o robô numa
// bolinha no CENTRO encostada na capa e as informações centralizadas embaixo. No pé,
// "Configurar" e o Testar (no lugar do coração da referência).
//
// ⚠️ Um link só por quadro: o nome, esticado por cima do quadro inteiro (`after:inset-0`).
// O "Configurar" do pé é só desenho (o clique cai no link de baixo); o Testar é o
// único botão de verdade e fica por cima (`z-10`). Botão dentro de link é HTML inválido.
import { Link } from 'react-router-dom';
import { Bot, Settings2, Smartphone, UserRound } from 'lucide-react';
import type { ResumoDoAgente, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { Button, Card } from '@/components/ui/ds';
import { quadroDoAgente } from '@/features/salesAgents/quadroDoAgente';
import { situacaoDaIa } from '@/features/salesAgents/situacao';
import { paramsDaIa } from '@/features/salesAgents/iaMenu';
import SeloSituacao from '../SeloSituacao';

export default function QuadroDoAgente({ agent, resumo, aoTestar }: { agent: SalesAgent; resumo: ResumoDoAgente | null; aoTestar: () => void }) {
  const q = quadroDoAgente(agent, resumo);
  // Sem `pagina`: o Configurar abre na primeira página com pendência.
  const para = `/ia-vendedora?${new URLSearchParams(paramsDaIa(agent.id, 'configurar'))}`;
  return (
    <Card className="group relative h-full gap-0 overflow-hidden p-0 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40">
      <div aria-hidden className="capa-do-agente h-24 shrink-0" />
      <span className="absolute right-3 top-3 rounded-full bg-card">
        <SeloSituacao compacto situacao={situacaoDaIa(agent, null)} />
      </span>

      <div className="flex flex-1 flex-col items-center px-5 pb-5 text-center">
        {/* `relative`: a capa tem posição (a trama de pontos) e, sem isto, pintaria por cima da bolinha. */}
        <span aria-hidden className="relative -mt-9 flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border bg-card shadow-sm">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-7 w-7" />
          </span>
        </span>

        <h3 className="mt-3 w-full truncate text-base font-semibold text-foreground">
          <Link to={para}
            className="after:absolute after:inset-0 after:rounded-[14px] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary/40">
            {agent.name}
          </Link>
        </h3>
        <span className="mt-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{q.modo}</span>

        <dl className="mt-3 space-y-0.5 text-sm">
          <div><dt className="inline text-muted-foreground">Próximo passo: </dt><dd className="inline text-foreground">{q.proximoPasso}</dd></div>
          <div><dt className="inline text-muted-foreground">Produto: </dt><dd className="inline text-foreground">{q.produto}</dd></div>
        </dl>

        {q.trintaDias && (
          <div className="mt-4 w-full">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Últimos 30 dias</p>
            <dl className="mt-1.5 grid auto-cols-fr grid-flow-col divide-x rounded-lg border bg-muted/30 py-2">
              {q.trintaDias.map((n) => (
                <div key={n.rotulo} className="flex flex-col-reverse justify-end px-1">
                  <dt className="text-[11px] leading-tight text-muted-foreground">{n.rotulo}</dt>
                  <dd className="text-base font-semibold tabular-nums text-foreground">{n.valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="mt-4 grid w-full gap-0.5 text-sm">
          <p className="flex min-w-0 items-center justify-center gap-1.5 text-foreground">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate"><span className="text-muted-foreground">Quem fala: </span>{q.quemFala}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">{q.numeros}</p>
        </div>

        {q.pendencia && (
          <span className="mt-3 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">Falta: {q.pendencia}</span>
        )}

        <div className="mt-auto flex w-full items-center gap-2 pt-5">
          <span aria-hidden
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border bg-background text-sm font-medium text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
            <Settings2 className="h-4 w-4" /> Configurar
          </span>
          <Button type="button" variant="outline" size="icon" title="Testar" aria-label={`Testar ${agent.name}`} onClick={aoTestar}
            className="relative z-10 h-9 w-9 shrink-0">
            <Smartphone className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}
