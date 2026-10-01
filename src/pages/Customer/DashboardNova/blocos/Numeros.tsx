// src/pages/Customer/DashboardNova/blocos/Numeros.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { numero } from '@/lib/formato';
import { Delta, Skeleton } from '../../DashboardV2/components/primitives';
import { isAvailable, type KpiKey } from '../../DashboardV2/types';
import { linkAgenda, linkPropostas } from '@/features/dashboard/links';
import type { ContextoBloco } from '../usePodeAbrir';
import { diaDoPeriodo } from './comum';

export const Numeros: React.FC<ContextoBloco> = ({ dados, carregando, visao, pode, abrirLista }) => {
  const navigate = useNavigate();
  const kpis = dados?.kpis;
  if (!isAvailable(kpis)) return carregando && !dados ? <Skeleton height={104} /> : null;

  const desde = diaDoPeriodo(dados?.period?.since);
  const ate = diaDoPeriodo(dados?.period?.until);
  const corretor = visao === 'corretor';
  const rotuloLeads = corretor ? 'Leads recebidos' : 'Leads captados';
  // Corretor: Propostas é só o número. A lista de Propostas ainda mostra as de
  // todo mundo, e o link prometeria "as suas" (decisão pendente com o dono).
  const propostasAbre = pode.propostas && !corretor;
  const cartoes: { chave: KpiKey; rotulo: string; acao?: () => void }[] = [
    { chave: 'leads', rotulo: rotuloLeads, acao: () => abrirLista('leads_periodo', rotuloLeads) },
    { chave: 'conversations', rotulo: 'Conversas', acao: () => abrirLista('conversas_periodo', 'Conversas') },
    { chave: 'visits_scheduled', rotulo: 'Visitas agendadas', acao: pode.agenda ? () => navigate(linkAgenda({ desde, ate })) : undefined },
    { chave: 'proposals', rotulo: 'Propostas', acao: propostasAbre ? () => navigate(linkPropostas({ desde, ate })) : undefined },
  ];

  return (
    <div className="lmfn-numeros">
      {cartoes.map(c => {
        const kpi = kpis[c.chave];
        const corpo = (
          <>
            <span className="lmfn-numero-rotulo">{c.rotulo}</span>
            <span className="lmfn-numero-valor">{kpi ? numero(kpi.value) : '—'}</span>
            {kpi && <Delta value={kpi.delta} suffix="vs. período anterior" />}
          </>
        );
        return c.acao ? (
          <button key={c.chave} type="button" className="lmfn-numero" onClick={c.acao}>{corpo}</button>
        ) : (
          <div key={c.chave} className="lmfn-numero">{corpo}</div>
        );
      })}
    </div>
  );
};
