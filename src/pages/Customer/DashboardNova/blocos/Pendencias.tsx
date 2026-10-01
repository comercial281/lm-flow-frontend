// src/pages/Customer/DashboardNova/blocos/Pendencias.tsx
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { numero, plural } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton } from '../../DashboardV2/components/primitives';
import { isAvailable } from '../../DashboardV2/types';
import { usePendingOffers } from '@/contexts/PendingOffersContext';
import { linkAceite } from '@/features/dashboard/links';
import type { ContextoBloco } from '../usePodeAbrir';
import type { PendenciaChave } from '../types';

const ROTULOS: Record<PendenciaChave, { gestor: string; corretor: string; dica: string; tom: 'alerta' | 'atencao' }> = {
  sem_responsavel:      { gestor: 'Leads sem responsável', corretor: 'Leads sem responsável', dica: 'Esperando alguém assumir', tom: 'alerta' },
  esperando_resposta:   { gestor: 'Esperando resposta há mais de 1 h', corretor: 'Seus leads esperando resposta', dica: 'O lead escreveu e ninguém respondeu', tom: 'alerta' },
  sem_contato:          { gestor: 'Sem contato do corretor há mais de 3 dias', corretor: 'Sem contato seu há mais de 3 dias', dica: 'Lead com dono que esfriou', tom: 'atencao' },
  visitas_a_confirmar:  { gestor: 'Visitas a confirmar', corretor: 'Visitas a confirmar', dica: 'Marcadas e ainda sem confirmação', tom: 'atencao' },
  visitas_sem_feedback: { gestor: 'Visitas sem feedback', corretor: 'Visitas sem feedback', dica: 'Aconteceram e ninguém contou como foi', tom: 'atencao' },
};

export const Pendencias: React.FC<ContextoBloco> = ({ dados, carregando, visao, abrirLista }) => {
  const navigate = useNavigate();
  const { offers } = usePendingOffers();
  const bloco = dados?.pending;
  const titulo = visao === 'corretor' ? 'Suas pendências' : 'Pendências';

  // As ofertas vêm da roleta, não do bloco: aparecem mesmo sem as pendências.
  const ofertas = visao === 'corretor' ? offers.length : 0;
  const linhaOfertas = ofertas > 0 && (
    <button type="button" className="lmfn-item" onClick={() => navigate(linkAceite(offers[0].id))}>
      <span className="lmfn-pilula lmfn-pilula-alerta">{numero(ofertas)}</span>
      <span className="lmfn-item-texto">Ofertas esperando seu aceite<small>Leads da roleta oferecidos a você</small></span>
      <ChevronRight size={14} aria-hidden style={{ color: 'var(--lmf-faint)' }} />
    </button>
  );

  if (!isAvailable(bloco)) {
    return (
      <GlassCard title={titulo}>
        {linhaOfertas}
        {carregando && !dados
          ? <Skeleton height={220} />
          : <EmptyBlock block={bloco} text="Não deu para carregar as pendências agora." />}
      </GlassCard>
    );
  }

  const total = bloco.rows.reduce((soma, r) => soma + r.total, 0) + ofertas;
  // Uma linha no teto (500+) deixa o total também "pelo menos".
  const totalNoTeto = bloco.rows.some(r => r.capped);

  return (
    <GlassCard
      title={titulo}
      subtitle={visao === 'corretor' ? 'Comece o dia por aqui' : 'O que precisa de alguém agora'}
      action={<span className={`lmfn-pilula${total ? ' lmfn-pilula-alerta' : ''}`}>{numero(total)}{totalNoTeto ? '+' : ''}</span>}
    >
      {linhaOfertas}
      {bloco.rows.map(r => {
        const rotulo = ROTULOS[r.key][visao];
        const antigos = r.older > 0 ? ` · ${plural(r.older, 'parado', 'parados')} desde ontem ou antes` : '';
        const valor = r.capped ? `${numero(r.total)}+` : numero(r.total);
        return (
          <button key={r.key} type="button" className="lmfn-item" onClick={() => abrirLista(r.key, rotulo)}>
            <span className={`lmfn-pilula${r.total ? ` lmfn-pilula-${ROTULOS[r.key].tom}` : ''}`}>{valor}</span>
            <span className="lmfn-item-texto">{rotulo}<small>{ROTULOS[r.key].dica}{antigos}</small></span>
            <ChevronRight size={14} aria-hidden style={{ color: 'var(--lmf-faint)' }} />
          </button>
        );
      })}
    </GlassCard>
  );
};
