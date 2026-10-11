// src/pages/Customer/DashboardNova/blocos/Resultados.tsx
import React from 'react';
import { VAZIO, numero, porcentagem } from '@/lib/formato';
import { EmptyBlock, GlassCard, Skeleton, formatCurrency } from '../base/primitives';
import { isAvailable } from '../base/types';
import type { ContextoBloco } from '../usePodeAbrir';

export const Resultados: React.FC<ContextoBloco> = ({ dados, carregando }) => {
  const bloco = dados?.results;
  if (!isAvailable(bloco)) {
    // Chave ausente = o servidor não mandou (recorte do corretor): o bloco não existe.
    if (dados && bloco === undefined) return null;
    return (
      <GlassCard title="Resultados">
        {carregando && !dados ? <Skeleton height={120} /> : <EmptyBlock block={bloco} text="Não deu para carregar os resultados agora." />}
      </GlassCard>
    );
  }
  const itens = [
    { rotulo: 'Vendas', valor: numero(bloco.sales) },
    { rotulo: 'VGV', valor: formatCurrency(bloco.vgv) },
    { rotulo: 'Ticket médio', valor: bloco.sales && bloco.ticket ? formatCurrency(bloco.ticket) : VAZIO },
    { rotulo: 'Lead que virou venda', valor: bloco.lead_to_sale_percent === null ? VAZIO : porcentagem(bloco.lead_to_sale_percent) },
  ];
  const boas = `${numero(bloco.good_visits)} ${bloco.good_visits === 1 ? 'visita boa' : 'visitas boas'}`;
  const realizadas = `${numero(bloco.visits_done)} ${bloco.visits_done === 1 ? 'realizada' : 'realizadas'}`;
  return (
    <GlassCard title="Resultados" subtitle="Vendas registradas no funil e visitas do período">
      <div className="lmfn-resumo">
        {itens.map(i => (
          <div key={i.rotulo} className="lmfn-resumo-item">
            <div className="lmfn-numero-rotulo">{i.rotulo}</div>
            <div className="lmfn-numero-valor">{i.valor}</div>
          </div>
        ))}
      </div>
      <p className="lmf-card-sub" style={{ marginTop: 12 }}>{`${boas} de ${realizadas}`}</p>
    </GlassCard>
  );
};
