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

  // O seletor sai da última resposta boa e vale também no erro: dá para trocar de
  // funil sem recarregar. Enquanto o funil novo não volta (ou depois de falhar),
  // mostra a escolha, não o da resposta antiga.
  const disponivel = isAvailable(bloco) ? bloco : null;
  const escolhido = disponivel && (funil.pendente ? filtros.pipelineId ?? disponivel.pipeline.id : disponivel.pipeline.id);
  const seletor = disponivel && disponivel.pipelines.length > 1 ? (
    <select className="lmf-select" aria-label="Funil" value={escolhido ?? undefined} onChange={e => mudarFunil(e.target.value)}>
      {disponivel.pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  ) : null;

  // Erro no pedido do funil: nunca mostrar o funil da última vez calado.
  if (funil.erro) {
    const acoes = (
      <div className="flex items-center gap-2">
        {seletor}
        <button type="button" className="lmf-card-sub"
          style={{ margin: 0, fontWeight: 600, color: 'var(--lmf-accent)', background: 'none', border: 0, cursor: 'pointer' }}
          onClick={funil.recarregar}>
          Tentar de novo
        </button>
      </div>
    );
    return <GlassCard title={titulo} action={acoes}><EmptyBlock text="Não deu para carregar o funil agora." /></GlassCard>;
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
  // que ele mostra sozinho, a etapa fica sem link. Enquanto o funil novo
  // carrega, as etapas na tela são do antigo: também sem link.
  const abreEtapa = pode.funil && !funil.pendente && recorteBateComDestino(dados?.scope ?? funil.dados?.scope, filtros);
  const max = Math.max(1, ...bloco.stages.map(s => s.current));

  return (
    // Mesmo aviso da área dos blocos: ocupado e esmaecido enquanto o funil novo não chega.
    <div className={funil.pendente ? 'lmfn-blocos-pendente' : undefined} aria-busy={funil.pendente || undefined}>
      <GlassCard title={titulo} subtitle="Leads em cada etapa agora" action={seletor ?? undefined}>
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
    </div>
  );
};
