// src/pages/Customer/DashboardNova/blocos/Numeros.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { numero } from '@/lib/formato';
import { Delta, Skeleton } from '../../DashboardV2/components/primitives';
import { isAvailable, type KpiKey } from '../../DashboardV2/types';
import { linkAgenda, linkPropostas } from '@/features/dashboard/links';
import type { ContextoBloco } from '../usePodeAbrir';
import { recorteBateComDestino } from '../visao';
import { CATALOGO } from '../catalogo';
import { diaDoPeriodo } from './comum';

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
  // Visitas agendadas conta o mês/semana/ano inteiro, inclusive as que ainda vão
  // acontecer: a Agenda abre nessa janela. Servidor antigo não manda; cai no período.
  const calendario = dados?.period?.calendar ?? dados?.period;
  const visitasDesde = diaDoPeriodo(calendario?.since);
  const visitasAte = diaDoPeriodo(calendario?.until);
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
    { chave: 'visits_scheduled', rotulo: 'Visitas agendadas', acao: agendaAbre ? () => navigate(linkAgenda({ desde: visitasDesde, ate: visitasAte })) : undefined },
    ...(corretor ? [] : [
      { chave: 'proposals' as KpiKey, rotulo: 'Propostas', acao: propostasAbre ? () => navigate(linkPropostas({ desde, ate })) : undefined },
    ]),
  ];

  return (
    <div>
      {titulo}
      <div className={`lmfn-numeros${cartoes.length === 3 ? ' lmfn-numeros-3' : ''}`}>
        {cartoes.map(c => {
          const kpi = kpis[c.chave];
          const corpo = (
            <>
              <span className="lmf-card-title">{c.rotulo}</span>
              <span className="lmfn-numero-valor">{kpi ? numero(kpi.value) : '—'}</span>
              {kpi && <Delta value={kpi.delta} suffix="vs. período anterior" />}
            </>
          );
          return c.acao ? (
            <button key={c.chave} type="button" className="lmf-glass lmf-card lmfn-numero" onClick={c.acao}>{corpo}</button>
          ) : (
            <div key={c.chave} className="lmf-glass lmf-card lmfn-numero">{corpo}</div>
          );
        })}
      </div>
    </div>
  );
};
