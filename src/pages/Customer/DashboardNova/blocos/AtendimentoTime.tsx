// src/pages/Customer/DashboardNova/blocos/AtendimentoTime.tsx
import React from 'react';
import { VAZIO, numero, porcentagem } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton, formatDuration } from '../base/primitives';
import { isAvailable } from '../base/types';
import type { ContextoBloco } from '../usePodeAbrir';
import type { TeamPerson } from '../types';

const MEDIANA_LIMITE = 15 * 60;

/** Por que o corretor precisa de atenção, ou null quando está tudo bem. */
export function motivoAtencao(p: TeamPerson): string | null {
  const motivos: string[] = [];
  if ((p.median_seconds ?? 0) > MEDIANA_LIMITE) motivos.push('Demora mais de 15 min para responder');
  if (p.visits_done > 0 && p.visits_with_feedback / p.visits_done < 0.5) motivos.push('Deu feedback em menos da metade das visitas');
  return motivos.length ? motivos.join(' e ') : null;
}

/** Demora mais de 15 min para responder, ou deu feedback em menos da metade das visitas. */
export function precisaAtencao(p: TeamPerson): boolean {
  return motivoAtencao(p) !== null;
}

function comparacao(agora: number | null, antes: number | null): string {
  if (agora === null || antes === null) return 'sem base de comparação';
  const diff = antes - agora;
  if (Math.abs(diff) < 30) return 'igual ao período anterior';
  return diff > 0
    ? `${formatDuration(diff)} mais rápido que o período anterior`
    : `${formatDuration(-diff)} mais lento que o período anterior`;
}

export const AtendimentoTime: React.FC<ContextoBloco> = ({ dados, carregando }) => {
  const bloco = dados?.team;
  if (!isAvailable(bloco)) {
    // Chave ausente = o servidor não mandou (recorte do corretor): o bloco não existe.
    if (dados && bloco === undefined) return null;
    return (
      <GlassCard title="Atendimento do time">
        {carregando && !dados ? <Skeleton height={220} /> : <EmptyBlock block={bloco} text="Não deu para carregar o atendimento agora." />}
      </GlassCard>
    );
  }
  const t = bloco.total;
  // A IA vem no próprio bloco do time; sem resposta dela no período, a linha some.
  const temIa = t.ai_median_seconds !== null && t.ai_samples > 0;

  return (
    <GlassCard title="Atendimento do time" subtitle="Quanto o lead espera, e se as visitas têm feedback">
      {/* O feedback das visitas é o quarto item do resumo, alinhado com os outros. */}
      <div className="lmfn-resumo">
        <div className="lmfn-resumo-item">
          <div className="lmfn-numero-rotulo">1ª resposta do time</div>
          <div className="lmfn-numero-valor">{t.median_seconds === null ? VAZIO : formatDuration(t.median_seconds)}</div>
          <div className="lmfn-resumo-legenda">{comparacao(t.median_seconds, t.previous_median_seconds)}</div>
        </div>
        {temIa && (
          <div className="lmfn-resumo-item">
            <div className="lmfn-numero-rotulo">1ª resposta da IA Vendedora</div>
            <div className="lmfn-numero-valor">{formatDuration(t.ai_median_seconds ?? 0)}</div>
          </div>
        )}
        <div className="lmfn-resumo-item">
          <div className="lmfn-numero-rotulo">Esperaram mais de 1 h</div>
          <div className="lmfn-numero-valor">{numero(t.waited_over_hour)}</div>
        </div>
        <div className="lmfn-resumo-item">
          <div className="lmfn-numero-rotulo">Visitas com feedback</div>
          <div className="lmfn-numero-valor">{t.feedback_percent === null ? VAZIO : porcentagem(t.feedback_percent, 0)}</div>
          <div className="lmfn-resumo-legenda">
            {t.feedback_percent === null ? 'Nenhuma visita realizada no período' : 'das visitas do período tiveram feedback'}
          </div>
        </div>
      </div>
      {bloco.people.length > 0 && (
        <table className="lmfn-tabela" style={{ marginTop: 16 }}>
          <thead>
            <tr><th>Corretor</th><th>1ª resposta</th><th>Esperaram mais de 1 h</th><th>Visitas com feedback</th></tr>
          </thead>
          <tbody>
            {bloco.people.map(p => {
              const motivo = motivoAtencao(p);
              return (
                <tr key={p.user_id}>
                  <td>
                    {motivo && (
                      <span role="img" aria-label={`Precisa de atenção: ${motivo}`} title={motivo} style={{ color: 'var(--lmf-warn)' }}>⚠ </span>
                    )}
                    {p.name}
                  </td>
                  <td>{p.median_seconds === null ? VAZIO : formatDuration(p.median_seconds)}</td>
                  <td>{numero(p.waited_over_hour)}</td>
                  <td>{p.visits_done ? `${numero(p.visits_with_feedback)} de ${numero(p.visits_done)}` : VAZIO}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </GlassCard>
  );
};
