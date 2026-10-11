// src/pages/Customer/DashboardNova/blocos/TempoNegociacao.tsx
import React from 'react';
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
 */
export const TempoNegociacao: React.FC<ContextoBloco> = ({ dados, carregando }) => {
  const bloco = dados?.negotiation_time;
  const titulo = 'Tempo médio de negociação';
  if (!isAvailable(bloco)) {
    if (dados && bloco === undefined) return null;
    return (
      <GlassCard title={titulo} className="lmfn-vez-card">
        {carregando && !dados ? <Skeleton height={160} /> : <EmptyBlock block={bloco} text="Não deu para carregar agora." />}
      </GlassCard>
    );
  }
  const linhas = [
    { rotulo: 'Até o ganho', dado: bloco.won, contagem: plural(bloco.won.count, 'ganho', 'ganhos') },
    { rotulo: 'Até a perda', dado: bloco.lost, contagem: plural(bloco.lost.count, 'perdido', 'perdidos') },
  ];
  return (
    <GlassCard title={titulo} subtitle="Da criação do card até fechar" className="lmfn-vez-card" bodyClassName="lmfn-vez-corpo">
      <div className="lmfn-negociacao">
        {linhas.map(l => (
          <div key={l.rotulo} className="lmfn-resumo-item">
            <div className="lmfn-numero-rotulo">{l.rotulo}</div>
            <div className="lmfn-numero-valor">{l.dado.avg_seconds === null ? VAZIO : tempoEmDias(l.dado.avg_seconds)}</div>
          </div>
        ))}
        <p className="lmf-card-sub" style={{ margin: 0 }}>{`${linhas[0].contagem} · ${linhas[1].contagem} no período`}</p>
      </div>
    </GlassCard>
  );
};
