// src/pages/Customer/DashboardNova/blocos/Funil.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { numero } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton } from '../../DashboardV2/components/primitives';
import { isAvailable } from '../../DashboardV2/types';
import { linkFunil } from '@/features/dashboard/links';
import type { ContextoBloco } from '../usePodeAbrir';
import { recorteBateComDestino } from '../visao';

export const Funil: React.FC<ContextoBloco> = ({ dados, visao, pode, filtros, funil, mudarFunil }) => {
  const navigate = useNavigate();
  // O Funil lê o pedido dele (dados, erro e espera próprios), não o dos outros blocos.
  const bloco = funil.dados?.pipeline;
  const titulo = visao === 'corretor' ? 'Seu funil' : 'Funil';
  // Erro no pedido do funil: nunca mostrar o funil da última vez calado.
  if (funil.erro) {
    const tentar = (
      <button type="button" className="lmf-card-sub"
        style={{ margin: 0, fontWeight: 600, color: 'var(--lmf-accent)', background: 'none', border: 0, cursor: 'pointer' }}
        onClick={funil.recarregar}>
        Tentar de novo
      </button>
    );
    return <GlassCard title={titulo} action={tentar}><EmptyBlock text="Não deu para carregar o funil agora." /></GlassCard>;
  }
  if (!isAvailable(bloco)) {
    return (
      <GlassCard title={titulo}>
        {funil.carregando && !funil.dados ? (
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
  const abreEtapa = pode.funil && recorteBateComDestino(dados?.scope ?? funil.dados?.scope, filtros);
  const max = Math.max(1, ...bloco.stages.map(s => s.current));
  // Enquanto o funil novo não volta, o seletor mostra a escolha, não o da resposta antiga.
  const escolhido = funil.pendente ? filtros.pipelineId ?? bloco.pipeline.id : bloco.pipeline.id;
  const seletor = bloco.pipelines.length > 1 ? (
    <select className="lmf-select" aria-label="Funil" value={escolhido} onChange={e => mudarFunil(e.target.value)}>
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
