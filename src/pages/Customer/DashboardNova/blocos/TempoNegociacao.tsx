// src/pages/Customer/DashboardNova/blocos/TempoNegociacao.tsx
import React, { useState } from 'react';
import { VAZIO, plural } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton } from '../base/primitives';
import { isAvailable } from '../base/types';
import type { ContextoBloco } from '../usePodeAbrir';
import { tempoEmDias } from './comum';

/**
 * TEMPO MÉDIO DE NEGOCIAÇÃO (frente 5 da Nova 27, 11/10/2026): cartão estreito ao
 * lado de Resultados, no molde do "Sua vez na fila". Da criação do card até o
 * Ganho e até o Perdido, entre os que fecharam no período, em todos os funis.
 * Só gestão: o corretor não recebe a chave e o cartão não existe.
 *
 * Um número por vez, com a troca Ganhos | Perdidos no topo, e a mesma altura de
 * Resultados (pedido do dono, 11/10: as duas linhas empilhadas esticavam a linha).
 */
export const TempoNegociacao: React.FC<ContextoBloco> = ({ dados, carregando }) => {
  const bloco = dados?.negotiation_time;
  const titulo = 'Tempo médio de negociação';
  // Antes de qualquer retorno (regra dos ganchos do React).
  const [qual, setQual] = useState<'won' | 'lost'>('won');
  if (!isAvailable(bloco)) {
    if (dados && bloco === undefined) return null;
    return (
      <GlassCard title={titulo} className="lmfn-negociacao-card">
        {carregando && !dados ? <Skeleton height={160} /> : <EmptyBlock block={bloco} text="Não deu para carregar agora." />}
      </GlassCard>
    );
  }
  const dado = bloco[qual];
  const contagem = qual === 'won' ? plural(dado.count, 'ganho', 'ganhos') : plural(dado.count, 'perdido', 'perdidos');
  // A troca fica ao lado do título (pedido do dono, 11/10): o cartão não passa da altura de Resultados.
  const troca = (
    <div className="lmfn-seg lmfn-seg-mini" role="group" aria-label="Ganhos ou perdidos">
      {(['won', 'lost'] as const).map(q => (
        <button key={q} type="button" aria-pressed={qual === q} onClick={() => setQual(q)}>
          {q === 'won' ? 'Ganhos' : 'Perdidos'}
        </button>
      ))}
    </div>
  );
  return (
    <GlassCard title={titulo} action={troca} className="lmfn-negociacao-card" bodyClassName="lmfn-negociacao">
      <div className="lmfn-numero-valor">{dado.avg_seconds === null ? VAZIO : tempoEmDias(dado.avg_seconds)}</div>
      <p className="lmf-card-sub" style={{ margin: 0 }} title={`Da criação do card até ${qual === 'won' ? 'o ganho' : 'a perda'}`}>
        {`${contagem} no período`}
      </p>
    </GlassCard>
  );
};
