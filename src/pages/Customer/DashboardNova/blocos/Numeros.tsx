// src/pages/Customer/DashboardNova/blocos/Numeros.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { numero } from '@/lib/formato';
import { Delta, Skeleton } from '../base/primitives';
import { isAvailable, type KpiKey } from '../base/types';
import { linkAgenda, linkPropostas } from '@/features/dashboard/links';
import type { ContextoBloco } from '../usePodeAbrir';
import { recorteBateComDestino } from '../visao';
import { CATALOGO } from '../catalogo';
import { diaDoPeriodo } from './comum';
import { NumeroQueConta } from '../base/NumeroQueConta';

export const Numeros: React.FC<ContextoBloco> = ({ dados, carregando, visao, pode, filtros, abrirLista }) => {
  const navigate = useNavigate();
  const kpis = dados?.kpis;
  // Título só para leitor de tela: quem navega por títulos não pula o bloco mais importante.
  const titulo = <h2 className="sr-only">{CATALOGO.numeros.titulo}</h2>;
  if (!isAvailable(kpis)) {
    if (carregando && !dados) return <Skeleton height={124} />;
    // Sem os números, dizer isso: nunca quatro zeros nem um buraco calado.
    return (
      <div>
        {titulo}
        <div className="lmf-glass lmf-card lmfn-numero"><span className="lmfn-numero-rotulo">Não deu para carregar os números agora.</span></div>
      </div>
    );
  }

  const desde = diaDoPeriodo(dados?.period?.since);
  const ate = diaDoPeriodo(dados?.period?.until);
  const corretor = visao === 'corretor';
  const rotuloLeads = corretor ? 'Leads recebidos' : 'Leads captados';
  // Corretor não vê Propostas na Dashboard (decisão do dono, 01/10/2026).
  // Agenda e Propostas não recebem time, corretor nem os filtros do painel:
  // fora do recorte que elas mostram sozinhas, o número fica sem link.
  const bate = recorteBateComDestino(dados?.scope, filtros);
  const agendaAbre = pode.agenda && bate;
  const propostasAbre = pode.propostas && bate;
  const cartoes: { chave: KpiKey; rotulo: string; acao?: () => void }[] = [
    { chave: 'leads', rotulo: rotuloLeads, acao: () => abrirLista('leads_periodo', rotuloLeads) },
    { chave: 'conversations', rotulo: 'Conversas', acao: () => abrirLista('conversas_periodo', 'Conversas') },
    // Realizadas = marcadas Realizada, pelo dia da visita (frente 5 da Nova 27, no
    // lugar de "Visitas agendadas"). A Agenda abre com o mesmo recorte.
    { chave: 'visits_done', rotulo: 'Visitas realizadas', acao: agendaAbre ? () => navigate(linkAgenda({ desde, ate, situacao: 'realizadas' })) : undefined },
    ...(corretor ? [] : [
      { chave: 'proposals' as KpiKey, rotulo: 'Propostas', acao: propostasAbre ? () => navigate(linkPropostas({ desde, ate })) : undefined },
    ]),
  ];

  return (
    <div>
      {titulo}
      <div className={`lmfn-numeros${cartoes.length === 3 ? ' lmfn-numeros-3' : ''}`}>
        {cartoes.map((c, i) => {
          const kpi = kpis[c.chave];
          // --lmfn-k atrasa a entrada de cada cartão (cascata do dashboard-nova.css).
          const cascata = { '--lmfn-k': i } as React.CSSProperties;
          const corpo = (
            <>
              <span className="lmfn-orbe" aria-hidden="true" />
              <span className="lmf-card-title">{c.rotulo}</span>
              <span className="lmfn-numero-valor">{kpi ? <NumeroQueConta valor={kpi.value} formatar={numero} /> : '—'}</span>
              {kpi && <Delta value={kpi.delta} suffix="vs. período anterior" />}
            </>
          );
          return c.acao ? (
            <button key={c.chave} type="button" className="lmf-glass lmf-card lmfn-numero" style={cascata} onClick={c.acao}>{corpo}</button>
          ) : (
            <div key={c.chave} className="lmf-glass lmf-card lmfn-numero" style={cascata}>{corpo}</div>
          );
        })}
      </div>
    </div>
  );
};
