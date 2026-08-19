import React from 'react';
import { EmptyBlock, formatCurrency, formatDuration, formatNumber, GlassCard } from './primitives';
import { isAvailable } from '../types';
import type {
  AgentBlock, AiBlock, AutomationsBlock, CapiBlock, PipelineBlock, QueueBlock, ResponseBlock, UpcomingBlock,
} from '../types';

/**
 * Leads que chegaram sem dono no período.
 *
 * Não entra na conta de ninguém — se entrasse, dois corretores contariam o
 * mesmo lead e a soma das partes passaria o total do gestor. Mas fica visível
 * porque no modo Leilão a roleta deixa o lead sem dono DE PROPÓSITO, e quem
 * chegar primeiro assume: o corretor precisa saber que tem lead esperando.
 *
 * Some quando não há nenhum — um "0 na fila" permanente vira ruído.
 */
export const QueueCard: React.FC<{ queue: QueueBlock; onOpen: () => void }> = ({ queue, onOpen }) => {
  if (!queue.leads && !queue.conversations) return null;

  return (
    <GlassCard
      title="Na fila, sem dono"
      subtitle="Chegaram no período e ainda não têm responsável"
      className="cursor-pointer"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') onOpen();
        }}
        className="flex items-end gap-8"
      >
        <div>
          <div style={{ fontSize: 12, color: 'var(--lmf-muted)' }}>Leads</div>
          <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-0.02em' }}>
            {formatNumber(queue.leads)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--lmf-muted)' }}>Conversas</div>
          <div style={{ fontSize: 20, fontWeight: 550, color: 'var(--lmf-muted)' }}>
            {formatNumber(queue.conversations)}
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

/** Funil do pipeline: quantidade por etapa, na ordem real do board. */
export const PipelineFunnel: React.FC<{
  pipeline: PipelineBlock;
  onSelect: (id: string) => void;
}> = ({ pipeline, onSelect }) => {
  const max = Math.max(...pipeline.stages.map(s => s.current), 1);

  return (
    <GlassCard
      title="Funil do pipeline"
      subtitle={pipeline.spend ? 'Quantidade por etapa e quanto custou colocar um lead em cada uma' : 'Quantidade parada em cada etapa e quantos entraram no período'}
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
                  {/* Custo por entrada na etapa. Só aparece quando há gasto
                      medido E alguém entrou: sem isso o número seria inventado. */}
                  {stage.cost_per_entry != null && (
                    <span className="lmf-pill" title="Investimento do período dividido por quantos entraram nesta etapa">
                      {formatCurrency(stage.cost_per_entry)}
                    </span>
                  )}
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

/** Os 4 números do agente que o Giovani pediu. */
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
    </GlassCard>
  );
};

/**
 * Card próprio da IA — antes era uma linha escondida dentro de "Agente".
 *
 * `leadsHandled`/`leadsTotal` já nascem recortados por dono/instância/tag (a
 * mesma unidade de "Leads captados"), então aparecem pra qualquer um que veja
 * o dashboard. `usage` (execuções/sessões/tokens) é métrica de plataforma sem
 * dono pra recortar — o backend omite a chave pra quem não tem
 * `dashboard.operations`, daí o `ai.usage &&` antes de desenhar.
 */
export const AiSection: React.FC<{
  ai: AiBlock;
  responseAi?: { samples: number; avg_seconds: number; median_seconds: number };
}> = ({ ai, responseAi }) => (
  <GlassCard title="IA" subtitle="Leads atendidos pelo agente de IA no período">
    {ai.leads_total === 0 ? (
      <EmptyBlock text="Nenhum lead no período." />
    ) : (
      <>
        <div className="flex items-end gap-8">
          <div>
            <div style={{ fontSize: 12, color: 'var(--lmf-muted)' }}>Leads atendidos pela IA</div>
            <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-0.02em' }}>
              {formatNumber(ai.leads_handled)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--lmf-muted)' }}>% dos leads do período</div>
            <div style={{ fontSize: 20, fontWeight: 550, color: 'var(--lmf-muted)' }}>
              {ai.leads_handled_percent.toFixed(1)}%
            </div>
          </div>
        </div>

        {responseAi && (
          <div className="lmf-row" style={{ marginTop: 14, borderTop: '1px solid rgba(42,27,73,0.7)', borderBottom: 0, paddingTop: 14 }}>
            <span className="lmf-row-sub">Mediana de resposta da IA</span>
            <span className="lmf-pill">{formatDuration(responseAi.median_seconds)}</span>
          </div>
        )}

        {ai.usage && (
          <div
            className="lmf-row"
            style={{
              marginTop: responseAi ? 8 : 14,
              borderTop: responseAi ? 0 : '1px solid rgba(42,27,73,0.7)',
              borderBottom: 0,
              paddingTop: responseAi ? 0 : 14,
            }}
          >
            <span className="lmf-row-sub">
              {formatNumber(ai.usage.sessions)} sessões · {formatNumber(ai.usage.executions)} execuções
            </span>
            <span className="lmf-pill">{formatNumber(ai.usage.tokens)} tokens</span>
          </div>
        )}
      </>
    )}
  </GlassCard>
);

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

/**
 * Tempo até a primeira resposta. Mediana em destaque: a média mente com
 * conversa esquecida.
 *
 * O número grande é o do TIME. A IA aparece embaixo, rotulada, porque ela
 * responde em segundos e somar as duas fazia o card dizer que o time é rápido
 * quando quem era rápido é o robô.
 */
export const ResponseTimeCard: React.FC<{ response: ResponseBlock }> = ({ response }) => {
  const semNada = response.samples === 0 && !response.ai;

  return (
    <GlassCard
      title="Tempo de resposta"
      subtitle={`${formatNumber(response.samples)} conversas respondidas pelo time`}
    >
      {semNada ? (
        <EmptyBlock text="Sem conversas respondidas no período." />
      ) : (
        <>
          {response.samples === 0 ? (
            // Só a IA respondeu no período. Dizer isso é o ponto do card.
            <EmptyBlock text="Nenhuma conversa respondida por uma pessoa no período." />
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

          {response.ai && (
            <div
              className="lmf-row"
              style={{ marginTop: 14, borderTop: '1px solid rgba(42,27,73,0.7)', borderBottom: 0, paddingTop: 14 }}
            >
              <span className="lmf-row-sub">
                IA respondeu {formatNumber(response.ai.samples)} conversas
              </span>
              <span className="lmf-pill">mediana {formatDuration(response.ai.median_seconds)}</span>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
};

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
