import React from 'react';
import { EmptyBlock, formatDuration, formatNumber, GlassCard } from './primitives';
import { isAvailable } from '../types';
import type {
  AgentBlock, AutomationsBlock, CapiBlock, PipelineBlock, ResponseBlock, UpcomingBlock,
} from '../types';

/** Funil do pipeline: quantidade por etapa, na ordem real do board. */
export const PipelineFunnel: React.FC<{
  pipeline: PipelineBlock;
  onSelect: (id: string) => void;
}> = ({ pipeline, onSelect }) => {
  const max = Math.max(...pipeline.stages.map(s => s.current), 1);

  return (
    <GlassCard
      title="Funil do pipeline"
      subtitle="Quantidade parada em cada etapa e quantos entraram no período"
      action={
        pipeline.pipelines.length > 1 ? (
          <select className="lmf-select" value={pipeline.pipeline.id} onChange={e => onSelect(e.target.value)} aria-label="Pipeline">
            {pipeline.pipelines.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : undefined
      }
    >
      {pipeline.stages.length === 0 ? (
        <EmptyBlock text="Este pipeline não tem etapas." />
      ) : (
        <ul>
          {pipeline.stages.map(stage => (
            <li key={stage.id} style={{ padding: '10px 0' }}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="lmf-row-title flex items-center gap-2 min-w-0">
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: stage.color, flex: 'none' }} />
                  <span className="truncate">{stage.name}</span>
                </span>
                <span className="flex items-center gap-3 flex-none">
                  <span style={{ fontSize: 11.5, color: 'var(--lmf-muted)' }}>+{formatNumber(stage.entered)} no período</span>
                  <strong style={{ fontSize: 14 }}>{formatNumber(stage.current)}</strong>
                </span>
              </div>
              <div className="lmf-bar-track">
                <div className="lmf-bar-fill" style={{ width: `${Math.max((stage.current / max) * 100, stage.current ? 3 : 0)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
};

/** Os 4 números do agente que o Giovani pediu + uso da IA. */
export const AgentSection: React.FC<{ agent: AgentBlock }> = ({ agent }) => {
  const items = [
    { label: 'Visitas agendadas', value: agent.visits_scheduled },
    { label: 'A confirmar', value: agent.visits_to_confirm, tone: 'warn' as const },
    { label: 'Atendidas no período', value: agent.visits_completed, tone: 'ok' as const },
    { label: 'Leads em follow-up', value: agent.leads_in_followup },
  ];

  return (
    <GlassCard title="Agente" subtitle="Agenda e acompanhamento no período selecionado">
      <div className="lmf-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        {items.map(item => (
          <div key={item.label}>
            <div style={{ fontSize: 12, color: 'var(--lmf-muted)' }}>{item.label}</div>
            <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.02em', marginTop: 6 }}>
              {formatNumber(item.value)}
            </div>
          </div>
        ))}
      </div>

      {isAvailable(agent.ai) ? (
        <div className="lmf-row" style={{ marginTop: 14, borderTop: '1px solid rgba(42,27,73,0.7)', borderBottom: 0, paddingTop: 14 }}>
          <span className="lmf-row-sub">IA: {formatNumber(agent.ai.sessions)} sessões · {formatNumber(agent.ai.executions)} execuções</span>
          <span className="lmf-pill">{formatNumber(agent.ai.tokens)} tokens</span>
        </div>
      ) : null}
    </GlassCard>
  );
};

/** Automações: o que mais dispara e os funis mais usados. */
export const AutomationsSection: React.FC<{ automations: AutomationsBlock }> = ({ automations }) => (
  <GlassCard
    title="Automações"
    subtitle={`${formatNumber(automations.total_runs)} execuções · ${formatNumber(automations.failures)} falhas`}
  >
    <h3 style={{ fontSize: 12, color: 'var(--lmf-muted)', marginBottom: 4 }}>Regras que mais disparam</h3>
    {automations.top_rules.length === 0 ? (
      <EmptyBlock text="Nenhuma regra disparou no período." />
    ) : (
      <ul>
        {automations.top_rules.map(rule => (
          <li key={rule.id} className="lmf-row">
            <span className="lmf-row-title truncate">{rule.name}</span>
            <span className="lmf-pill">{formatNumber(rule.runs)}</span>
          </li>
        ))}
      </ul>
    )}

    <h3 style={{ fontSize: 12, color: 'var(--lmf-muted)', margin: '16px 0 4px' }}>Disparos por funil</h3>
    {!isAvailable(automations.funnels) ? (
      <EmptyBlock block={automations.funnels} />
    ) : automations.funnels.items.length === 0 ? (
      <EmptyBlock text="Nenhum funil disparado no período." />
    ) : (
      <ul>
        {automations.funnels.items.map(funnel => (
          <li key={funnel.id} className="lmf-row">
            <span className="lmf-row-title truncate">{funnel.name}</span>
            <span className="lmf-pill">{formatNumber(funnel.dispatches)}</span>
          </li>
        ))}
      </ul>
    )}
  </GlassCard>
);

/** CAPI: qualificados x desqualificados, e o que falhou ao enviar. */
export const CapiSection: React.FC<{ capi: CapiBlock }> = ({ capi }) => (
  <GlassCard
    title="Conversões CAPI"
    subtitle={`${formatNumber(capi.total_sent)} enviadas · ${formatNumber(capi.total_failed)} falharam`}
  >
    {capi.events.length === 0 ? (
      <EmptyBlock text="Nenhuma conversão disparada no período." />
    ) : (
      <ul>
        {capi.events.map(event => (
          <li key={event.event} className="lmf-row">
            <span className="lmf-row-title">{event.event}</span>
            <span className="flex items-center gap-2">
              <span className="lmf-pill" data-tone="ok">
                {formatNumber(event.sent)} ok
              </span>
              {event.failed > 0 && (
                <span className="lmf-pill" data-tone="warn">
                  {formatNumber(event.failed)} falhou
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    )}
  </GlassCard>
);

/** Tempo de resposta. Mediana em destaque: a média mente com conversa esquecida. */
export const ResponseTimeCard: React.FC<{ response: ResponseBlock }> = ({ response }) => (
  <GlassCard title="Tempo de resposta" subtitle={`${formatNumber(response.samples)} conversas medidas`}>
    {response.samples === 0 ? (
      <EmptyBlock text="Sem conversas respondidas no período." />
    ) : (
      <div className="flex items-end gap-8">
        <div>
          <div style={{ fontSize: 12, color: 'var(--lmf-muted)' }}>Mediana</div>
          <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-0.02em' }}>
            {formatDuration(response.median_seconds)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--lmf-muted)' }}>Média</div>
          <div style={{ fontSize: 20, fontWeight: 550, color: 'var(--lmf-muted)' }}>
            {formatDuration(response.avg_seconds)}
          </div>
        </div>
      </div>
    )}
  </GlassCard>
);

/** Próximas visitas: olha pra frente a partir de agora, não pro filtro. */
export const UpcomingVisits: React.FC<{ upcoming: UpcomingBlock }> = ({ upcoming }) => (
  <GlassCard title="Próximas visitas" subtitle="Agendadas para os próximos 14 dias">
    {upcoming.items.length === 0 ? (
      <EmptyBlock text="Nenhuma visita agendada à frente." />
    ) : (
      <ul>
        {upcoming.items.map(visit => {
          const when = visit.scheduled_at ? new Date(visit.scheduled_at) : null;
          return (
            <li key={visit.id} className="lmf-row">
              <span className="min-w-0">
                <div className="lmf-row-title truncate">{visit.contact_name}</div>
                <div className="lmf-row-sub truncate">
                  {when
                    ? when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : 'Sem horário'}
                  {visit.realtor_name ? ` · c/ ${visit.realtor_name}` : ''}
                </div>
              </span>
              <span className="lmf-pill" data-tone={visit.confirmed ? 'ok' : 'warn'}>
                {visit.confirmed ? 'Confirmada' : 'A confirmar'}
              </span>
            </li>
          );
        })}
      </ul>
    )}
  </GlassCard>
);
