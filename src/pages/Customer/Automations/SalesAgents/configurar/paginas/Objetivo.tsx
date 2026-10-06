// Repasse · Objetivo (onda 3). Até onde ela vai: Qualificar e passar / Agendar
// visita, e a linha da conversa. Grava `reach` + o espelho `booking_enabled` (o
// roteiro de hoje lê o espelho). Mudar o objetivo NUNCA mexe no destino.
//
// ⚠️ Voltar pra "Qualificar e passar" com o critério "Visita marcada" corrige o
// critério pro das obrigatórias (senão ela nunca passaria), sempre por keepBriefing.
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import type { AlcanceDaIa, HandoffMode } from '@/services/salesAgents/salesAgentsService';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { keepBriefing } from '@/features/salesAgents/handoffBriefing';
import type { PropsDaPagina } from '../paginas';

const OBJETIVOS = [
  { valor: 'qualify' as const, rotulo: 'Qualificar e passar', descricao: 'Entende o que o lead procura, faz as perguntas e passa pra uma pessoa.' },
  { valor: 'visit' as const, rotulo: 'Agendar visita', descricao: 'Além de qualificar, marca a visita na agenda e passa com a visita marcada.' },
];

export default function Objetivo({ agent, gravar, irPara }: PropsDaPagina) {
  const alcance = lerEscolhas(agent).alcance;
  const cfg = agent.transfer_config ?? {};

  const escolher = (a: AlcanceDaIa) => {
    const base = { reach: a, booking_enabled: a === 'visit' };
    if (a === 'qualify' && cfg.mode === 'pos_visita') {
      return gravar({ ...base, transfer_config: keepBriefing(cfg, { ...cfg, mode: 'checklist' as HandoffMode }) }, ['transfer_config.mode']);
    }
    return gravar(base);
  };

  return (
    <Secoes>
      <Secao titulo="Até onde ela vai" descricao={'Define o fim da conversa dela. Com "Agendar visita", a página Agendamento é liberada.'}>
        <CartoesDeEscolha<AlcanceDaIa> rotulo="Até onde ela vai" valor={alcance} opcoes={OBJETIVOS} aoEscolher={(a) => void escolher(a)} />
        <ol aria-label="Como fica a conversa" className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
          <li className="rounded-lg border border-border bg-background px-3 py-2">Lead chega</li>
          <li aria-hidden className="text-muted-foreground">→</li>
          <li className="rounded-lg border border-border bg-background px-3 py-2">Qualifica</li>
          <li aria-hidden className="text-muted-foreground">→</li>
          {alcance === 'visit' && (
            <>
              <li className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-primary">Agenda a visita</li>
              <li aria-hidden className="text-muted-foreground">→</li>
            </>
          )}
          <li className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-primary">Passa pro corretor</li>
        </ol>
        {alcance === 'visit' && <Button type="button" variant="outline" className="self-start" onClick={() => irPara('agendamento')}>Abrir Agendamento</Button>}
      </Secao>
    </Secoes>
  );
}
