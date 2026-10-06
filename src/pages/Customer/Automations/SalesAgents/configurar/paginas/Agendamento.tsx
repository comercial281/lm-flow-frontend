// Repasse · Agendamento (onda 3). Só com o objetivo "Agendar visita" (senão o
// aviso com "Mudar o objetivo"). Duração em botões, antecedência, janela (com a
// Agenda de Visitas ligada, vale a da Agenda), as 2 regras, a AVALIAÇÃO NO GOOGLE
// (que agora sai só depois de visita realizada: onda 1, §6.9) e o "Quando propor"
// (`playbook.vars.lead_pronto`, que morava escondido no roteiro).
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import LinhaComChave from '@/components/base/LinhaComChave';
import { useAgendaLigada } from '@/features/visits/useAgendaLigada';
import { salesAgentsService, type PlaybookVars, type VisitConfig } from '@/services/salesAgents/salesAgentsService';
import TextoNaHora from '../TextoNaHora';
import JanelaDaSemana from './JanelaDaSemana';
import { Aviso } from '../Aviso';
import { agendamentoTravado, type PropsDaPagina } from '../paginas';

const DURACOES = [30, 45, 60, 90];
const rotuloDuracao = (m: number) => (m === 60 ? '1 hora' : m === 90 ? '1h30' : `${m} min`);

export default function Agendamento({ agent, gravar, irPara }: PropsDaPagina) {
  const agendaLigada = useAgendaLigada().ligada === true;
  const [padraoDoPronto, setPadraoDoPronto] = useState<string | undefined>();
  useEffect(() => {
    let vivo = true;
    salesAgentsService.playbook(agent.id).then((p) => { if (vivo) setPadraoDoPronto(p.slot_defaults?.lead_pronto); }).catch(() => {});
    return () => { vivo = false; };
  }, [agent.id]);

  if (agendamentoTravado(agent)) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-border bg-card p-10 text-center">
        <Lock className="h-7 w-7 text-muted-foreground" aria-hidden />
        <b>Ela não agenda visita</b>
        <p className="text-sm text-muted-foreground">Em Objetivo, ela está como "Qualificar e passar".</p>
        <Button type="button" onClick={() => irPara('objetivo')}>Mudar o objetivo</Button>
      </div>
    );
  }

  const c: VisitConfig = agent.visit_config ?? {};
  const gravarVisita = (p: Partial<VisitConfig>) =>
    gravar({ visit_config: { ...c, ...p } }, Object.keys(p).map((k) => `visit_config.${k}`));
  const duracao = agent.visit_duration_minutes ?? 60;
  const duracoes = DURACOES.includes(duracao) ? DURACOES : [...DURACOES, duracao].sort((a, b) => a - b);
  const playbook = agent.playbook ?? {};
  const vars = (playbook.vars ?? {}) as PlaybookVars;

  return (
    <Secoes>
      <Secao titulo="Visita" descricao="Quanto tempo ocupa na agenda e com quanta antecedência ela marca.">
        <BotoesDeEscolha rotulo="Duração" valor={String(duracao)} opcoes={duracoes.map((m) => ({ valor: String(m), rotulo: rotuloDuracao(m) }))}
          aoEscolher={(v) => void gravar({ visit_duration_minutes: Number(v) })} />
        <div className="flex flex-wrap items-end gap-3">
          <TextoNaHora id="visita-minimo" tipo="numero" min={0} rotulo="Antecedência mínima (horas)" className="w-48" salvo={String(c.min_advance_hours ?? 24)}
            aoGravar={(v) => gravarVisita({ min_advance_hours: Math.max(0, Number(v) || 0) })} />
          <TextoNaHora id="visita-maximo" tipo="numero" min={1} rotulo="Até quantos dias pra frente" className="w-48" salvo={String(c.max_advance_days ?? 30)}
            aoGravar={(v) => gravarVisita({ max_advance_days: Math.max(1, Number(v) || 1) })} />
        </div>
      </Secao>

      <Secao titulo="Janela de visita" descricao="Dias e horas que ela pode oferecer. Com a Agenda ligada, vale a da Agenda.">
        {agendaLigada ? (
          <Aviso tom="neutro">Os dias e horários vêm da Agenda de Visitas, a mesma regra de quem marca à mão.</Aviso>
        ) : (
          <JanelaDaSemana idBase="visita" rotuloDias="Dias de visita"
            janelas={[{ days: c.days ?? [1, 2, 3, 4, 5], start: c.start ?? '09:00', end: c.end ?? '18:00' }]}
            aoGravar={([w]) => gravarVisita({ days: w.days, start: w.start, end: w.end })} />
        )}
      </Secao>

      <Secao titulo="Regras" descricao="O que ela confere antes de marcar.">
        <LinhaComChave rotulo="Visita para hoje só com o corretor confirmando"
          descricao="Pra hoje ela não confirma sozinha e nunca afirma que alguém estará no local: quem confirma presença é o corretor."
          ligada={c.same_day_requires_human !== false} aoMudar={(v) => gravarVisita({ same_day_requires_human: v })} />
        <LinhaComChave rotulo="Evitar dois leads no mesmo horário" ligada={c.avoid_double_booking !== false}
          aoMudar={(v) => gravarVisita({ avoid_double_booking: v })} />
      </Secao>

      <Secao titulo="Avaliação no Google" descricao="Depois de uma visita realizada, ela pede pro lead avaliar a imobiliária. Visita cancelada ou em que o lead faltou não pede.">
        <LinhaComChave rotulo="Pedir avaliação depois da visita" ligada={!!agent.ask_google_review} aoMudar={(v) => gravar({ ask_google_review: v })}>
          <TextoNaHora id="visita-google" rotulo="Link de avaliação do Google" salvo={agent.google_review_link ?? ''} placeholder="g.page/r/…"
            ajuda="Sai 2 horas depois de o corretor marcar a visita como realizada, dentro da janela de envio, uma vez por lead."
            aoGravar={(v) => gravar({ google_review_link: v.trim() || null })} />
        </LinhaComChave>
      </Secao>

      <Secao titulo="Quando propor" descricao="O sinal de que o lead está pronto pra ouvir o convite da visita.">
        <TextoNaHora id="visita-quando" rotulo="Quando propor a visita" salvo={vars.lead_pronto ?? ''} placeholder={padraoDoPronto}
          ajuda="Vazio: vale o de fábrica."
          aoGravar={(v) => gravar({ playbook: { ...playbook, vars: { ...vars, lead_pronto: v.trim() || undefined } } }, ['playbook.vars.lead_pronto'])} />
      </Secao>
    </Secoes>
  );
}
