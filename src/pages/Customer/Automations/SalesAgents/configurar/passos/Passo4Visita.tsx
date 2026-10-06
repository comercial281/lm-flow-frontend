// Passo 4 · Visita. Só existe quando ela vai até o fim.
//
// "Horário comercial" = seg a sex, 09:00 às 18:00 (o padrão de fábrica do servidor,
// SalesAgent::DEFAULT_VISIT_CONFIG). Com a Agenda de Visitas ligada, dias e horário
// vêm de lá e não são gravados aqui (o que já está em visit_config fica guardado).
// Datas bloqueadas saíram da tela (moram na Agenda) e ficam intactas no banco.
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/ds';
import { Secao } from '@/components/base/Secao';
import { CampoTexto } from '@/components/base/Campo';
import { WEEKDAYS } from '@/components/schedule/scheduleWindows';
import { useAgendaLigada } from '@/features/visits/useAgendaLigada';
import { lerEscolhas } from '@/features/salesAgents/tresEscolhas';
import { proximosHorarios } from '@/features/salesAgents/resumoDosPassos';
import { cn } from '@/lib/utils';
import { useRascunho } from '../useRascunho';
import { CAMPOS_DO_PASSO } from '../camposDosPassos';
import { Aviso, Caixa, CascaDoPasso, Escolha, type OpcaoDeEscolha } from '../pecas';
import type { PropsDoPasso } from '../passos';

const COMERCIAL = { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' };
type ModoHorario = 'comercial' | 'proprio';
const MODOS: OpcaoDeEscolha<ModoHorario>[] = [
  { valor: 'comercial', titulo: 'Horário comercial (seg a sex, 09:00 às 18:00)' },
  { valor: 'proprio', titulo: 'Um horário próprio' },
];

const ehComercial = (c: { days?: number[]; start?: string; end?: string }) =>
  JSON.stringify([...(c.days ?? COMERCIAL.days)].sort()) === JSON.stringify(COMERCIAL.days)
  && (c.start ?? COMERCIAL.start) === COMERCIAL.start && (c.end ?? COMERCIAL.end) === COMERCIAL.end;

export default function Passo4Visita({ agent, aoSalvo, irParaPasso }: PropsDoPasso) {
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DO_PASSO[4], aoSalvo);
  const agendaLigada = useAgendaLigada().ligada === true;
  const [modo, setModo] = useState<ModoHorario>(ehComercial(agent.visit_config ?? {}) ? 'comercial' : 'proprio');
  useEffect(() => setModo(ehComercial(agent.visit_config ?? {}) ? 'comercial' : 'proprio'), [agent]);

  const c = rascunho.visit_config ?? {};
  const set = (p: Partial<typeof c>) => mudar({ visit_config: { ...c, ...p } });
  const dias = c.days ?? COMERCIAL.days;
  const horarios = useMemo(
    () => proximosHorarios(rascunho.visit_config ?? {}, new Date(), rascunho.visit_duration_minutes ?? 60),
    [rascunho.visit_config, rascunho.visit_duration_minutes],
  );

  if (lerEscolhas(agent).alcance !== 'visit') {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Visita</h1>
        <Aviso tom="neutro">Ela só marca visita quando vai até o fim. Hoje ela só qualifica e passa.</Aviso>
        <Button type="button" variant="outline" onClick={() => irParaPasso(2)}>Mudar em Objetivo</Button>
      </div>
    );
  }

  const escolherModo = (m: ModoHorario) => {
    setModo(m);
    if (m === 'comercial') set(COMERCIAL);
  };
  const alternarDia = (d: number) => set({ days: dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort((a, b) => a - b) });

  const previa = (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Próximos horários que ela ofereceria</p>
      {agendaLigada ? (
        <p className="text-sm">Os dias e horários vêm da Agenda de Visitas.</p>
      ) : horarios.length ? (
        <ul className="space-y-1 text-sm">{horarios.map((h) => <li key={h}>{h}</li>)}</ul>
      ) : (
        <p className="text-sm">Nenhum horário dentro da antecedência escolhida.</p>
      )}
    </div>
  );

  return (
    <CascaDoPasso numero={4} previa={previa} pendente={pendente} salvando={salvando} erro={erro} aoSalvar={() => void salvar()} aoDescartar={descartar}>
      <Secao titulo="Duração e antecedência" descricao="Quanto tempo a visita ocupa na agenda e com quanto tempo de antecedência ela marca.">
        <CampoTexto id="p4-duracao" type="number" min={15} max={480} rotulo="Duração da visita (minutos)"
          valor={String(rascunho.visit_duration_minutes ?? 60)} aoMudar={(v) => mudar({ visit_duration_minutes: Number(v) || 0 })} />
        <CampoTexto id="p4-min" type="number" min={0} rotulo="Antecedência mínima (horas)"
          valor={String(c.min_advance_hours ?? 24)} aoMudar={(v) => set({ min_advance_hours: Math.max(0, Number(v) || 0) })} />
        <CampoTexto id="p4-max" type="number" min={1} rotulo="Antecedência máxima (dias)"
          valor={String(c.max_advance_days ?? 30)} aoMudar={(v) => set({ max_advance_days: Math.max(1, Number(v) || 1) })} />
      </Secao>

      <Secao titulo="Regras" descricao="O que ela confere antes de marcar.">
        <Caixa id="p4-mesmo-dia" rotulo="Visita para hoje só com o corretor confirmando"
          descricao="Pra hoje ela não confirma sozinha e nunca afirma que alguém estará no local: quem confirma presença é o corretor." marcada={c.same_day_requires_human !== false}
          aoMudar={(v) => set({ same_day_requires_human: v })} />
        <Caixa id="p4-dois-leads" rotulo="Evitar dois leads no mesmo horário" marcada={c.avoid_double_booking !== false}
          aoMudar={(v) => set({ avoid_double_booking: v })} />
      </Secao>

      <Secao titulo="Horário de visita" descricao="Em que dias e horários ela pode oferecer a visita.">
        {agendaLigada ? (
          <Aviso tom="neutro">Os dias e horários vêm da Agenda de Visitas, a mesma regra de quem marca à mão.</Aviso>
        ) : (
          <>
            <Escolha nome="horario-visita" legenda="Horário de visita" valor={modo} opcoes={MODOS} aoEscolher={escolherModo} />
            {modo === 'proprio' && (
              <>
                <div role="group" aria-label="Dias da visita" className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(([d, rotulo]) => (
                    <button key={d} type="button" aria-pressed={dias.includes(d)} onClick={() => alternarDia(d)}
                      className={cn('rounded-md border px-3 py-1.5 text-sm', dias.includes(d) ? 'border-primary bg-primary/10' : 'border-border')}>
                      {rotulo}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <CampoTexto id="p4-inicio" type="time" rotulo="Das" valor={c.start ?? '09:00'} aoMudar={(v) => set({ start: v })} />
                  <CampoTexto id="p4-fim" type="time" rotulo="Até" valor={c.end ?? '18:00'} aoMudar={(v) => set({ end: v })} />
                </div>
              </>
            )}
          </>
        )}
      </Secao>
    </CascaDoPasso>
  );
}
