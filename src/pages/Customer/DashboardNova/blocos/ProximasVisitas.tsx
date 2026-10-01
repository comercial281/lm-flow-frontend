// src/pages/Customer/DashboardNova/blocos/ProximasVisitas.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { dataCurta, hora } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton } from '../base/primitives';
import { isAvailable } from '../base/types';
import { linkAgenda } from '@/features/dashboard/links';
import type { ContextoBloco } from '../usePodeAbrir';

export const ProximasVisitas: React.FC<ContextoBloco> = ({ dados, carregando, visao, pode }) => {
  const navigate = useNavigate();
  const bloco = dados?.upcoming;
  const titulo = visao === 'corretor' ? 'Suas próximas visitas' : 'Próximas visitas';
  const acao = pode.agenda ? (
    <button
      type="button"
      className="lmf-card-sub"
      style={{ margin: 0, fontWeight: 600, color: 'var(--lmf-accent)', background: 'none', border: 0, cursor: 'pointer' }}
      onClick={() => navigate(linkAgenda())}
    >
      Abrir agenda
    </button>
  ) : undefined;

  if (!isAvailable(bloco)) {
    return (
      <GlassCard title={titulo} action={acao}>
        {carregando && !dados ? <Skeleton height={200} /> : <EmptyBlock block={bloco} text="Não deu para carregar as visitas agora." />}
      </GlassCard>
    );
  }
  if (bloco.items.length === 0) {
    return <GlassCard title={titulo} action={acao}><EmptyBlock text="Nenhuma visita marcada para os próximos 14 dias." /></GlassCard>;
  }

  return (
    <GlassCard title={titulo} subtitle="As próximas, até 14 dias" action={acao}>
      {bloco.items.map(v => {
        // Imóvel (quando o servidor manda) e, para o gestor, o corretor.
        const detalhe = [v.property_title, visao === 'gestor' ? v.realtor_name : null].filter(Boolean).join(' · ');
        const corpo = (
          <>
            <span style={{ width: 64, fontSize: 12, color: 'var(--lmf-muted)' }}>
              {dataCurta(v.scheduled_at)}
              <b style={{ display: 'block', color: 'var(--lmf-text)', fontSize: 14 }}>{hora(v.scheduled_at)}</b>
            </span>
            <span className="lmfn-item-texto">
              {v.contact_name}
              {detalhe && <small>{detalhe}</small>}
            </span>
            <span className={`lmfn-pilula${v.confirmed ? '' : ' lmfn-pilula-atencao'}`}>{v.confirmed ? 'Confirmada' : 'A confirmar'}</span>
          </>
        );
        return pode.agenda ? (
          <button key={v.id} type="button" className="lmfn-item" onClick={() => navigate(linkAgenda({ visita: v.id }))}>{corpo}</button>
        ) : (
          <div key={v.id} className="lmfn-item">{corpo}</div>
        );
      })}
    </GlassCard>
  );
};
