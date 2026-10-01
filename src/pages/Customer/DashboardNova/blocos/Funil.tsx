// src/pages/Customer/DashboardNova/blocos/Funil.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { numero } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton } from '../../DashboardV2/components/primitives';
import { isAvailable } from '../../DashboardV2/types';
import { linkFunil } from '@/features/dashboard/links';
import type { ContextoBloco } from '../usePodeAbrir';
import { recorteBateComDestino } from '../visao';

export const Funil: React.FC<ContextoBloco> = ({ dados, carregando, visao, pode, filtros, mudarFunil }) => {
  const navigate = useNavigate();
  const bloco = dados?.pipeline;
  const titulo = visao === 'corretor' ? 'Seu funil' : 'Funil';
  if (!isAvailable(bloco)) {
    return (
      <GlassCard title={titulo}>
        {carregando && !dados ? (
          <Skeleton height={200} />
        ) : (
          // Só erro (ou bloco ausente) vira "não deu para carregar"; os outros motivos o EmptyBlock explica.
          <EmptyBlock block={bloco} text={!bloco || bloco.reason === 'error' ? 'Não deu para carregar o funil agora.' : undefined} />
        )}
      </GlassCard>
    );
  }
  // O funil não recebe time, corretor nem os filtros do painel: fora do recorte
  // que ele mostra sozinho, a etapa fica sem link.
  const abreEtapa = pode.funil && recorteBateComDestino(dados?.scope, filtros);
  const max = Math.max(1, ...bloco.stages.map(s => s.current));
  const seletor = bloco.pipelines.length > 1 ? (
    <select className="lmf-select" aria-label="Funil" value={bloco.pipeline.id} onChange={e => mudarFunil(e.target.value)}>
      {bloco.pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  ) : undefined;

  return (
    <GlassCard title={titulo} subtitle="Leads em cada etapa agora" action={seletor}>
      {bloco.stages.length === 0 && <EmptyBlock text="Este funil ainda não tem etapas." />}
      {bloco.stages.map(s => {
        const corpo = (
          <>
            <span className="lmfn-item-texto" style={{ flex: '0 0 40%' }}>{s.name}</span>
            <span style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--lmf-track)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${(s.current / max) * 100}%`, background: 'var(--lmf-accent)' }} />
            </span>
            <span style={{ width: 40, textAlign: 'right', fontWeight: 600 }}>{numero(s.current)}</span>
          </>
        );
        return abreEtapa ? (
          <button key={s.id} type="button" className="lmfn-item" onClick={() => navigate(linkFunil(bloco.pipeline.id, s.id))}>{corpo}</button>
        ) : (
          <div key={s.id} className="lmfn-item">{corpo}</div>
        );
      })}
    </GlassCard>
  );
};
