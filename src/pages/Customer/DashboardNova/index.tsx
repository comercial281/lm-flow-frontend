// src/pages/Customer/DashboardNova/index.tsx
import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCan } from '@/hooks/useCan';
import EmptyState from '@/components/base/EmptyState';
import { GlassCard, Skeleton } from '../DashboardV2/components/primitives';
import '../DashboardV2/styles/lmf.css';
import './dashboard-nova.css';
import { Cabecalho, PERIODOS } from './Cabecalho';
import { ListaRapida } from './ListaRapida';
import { BLOCOS_API, linhasDaVisao, type BlocoId } from './catalogo';
import { gestorVendoComoCorretor, visaoDoEscopo } from './visao';
import { useDashboardNova } from './useDashboardNova';
import { usePodeAbrir, type ContextoBloco } from './usePodeAbrir';
import type { FiltrosDashboard, ListaKind } from './types';
import { Imoveis } from './blocos/Imoveis';
import { Numeros } from './blocos/Numeros';
import { Pendencias } from './blocos/Pendencias';
import { ProximasVisitas } from './blocos/ProximasVisitas';
import { RoletaAgora } from './blocos/RoletaAgora';
import { AtendimentoTime } from './blocos/AtendimentoTime';
import { Funil } from './blocos/Funil';
import { Resultados } from './blocos/Resultados';
import { LeadsDiaSemana, LeadsHorario, LeadsSeisMeses, MapaCalor, Origem } from './blocos/Analise';

const COMPONENTES: Record<BlocoId, React.FC<ContextoBloco>> = {
  imoveis: Imoveis, numeros: Numeros, pendencias: Pendencias, proximas_visitas: ProximasVisitas,
  roleta_agora: RoletaAgora, atendimento_time: AtendimentoTime, funil: Funil, resultados: Resultados,
  leads_dia_semana: LeadsDiaSemana, leads_horario: LeadsHorario, leads_seis_meses: LeadsSeisMeses,
  origem: Origem, mapa_calor: MapaCalor,
};

const saudacao = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

/** A lista rápida em uso. Fechar NÃO apaga: o painel desliza para fora com ela. */
interface ListaAberta { kind: ListaKind; titulo: string; limitado: boolean }

/** Antes da primeira resposta não se sabe a visão: nada de desenhar a do gestor para um corretor. */
const Esqueleto: React.FC = () => (
  <div role="status" aria-label="Carregando os números">
    <div className="lmfn-linha lmfn-linha-principal">
      <Skeleton height={260} />
      <div className="lmfn-coluna">
        <Skeleton height={104} />
        <Skeleton height={220} />
      </div>
    </div>
    <div className="lmfn-linha">
      <Skeleton height={200} />
      <Skeleton height={200} />
    </div>
  </div>
);

/**
 * Dashboard nova (fase 4, jornada 1). Duas visões, gestor e corretor, saídas do
 * recorte que o SERVIDOR resolveu. Blocos independentes (catalogo.ts), todo
 * número leva a algum lugar, e pendências são o que está aberto agora.
 */
const DashboardNova: React.FC = () => {
  const { user } = useAuth();
  const pode = usePodeAbrir();
  const can = useCan();
  const [filtros, setFiltros] = useState<FiltrosDashboard>({ preset: 'last_7_days' });
  const [lista, setLista] = useState<ListaAberta | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const { dados, carregando, pendente, erro, recarregar } = useDashboardNova(filtros, BLOCOS_API);

  // `dados.scope` passa adiante como veio (mesmo objeto): o Cabecalho confere
  // o corretor descartado pelo servidor uma vez por resposta, pela referência.
  const scope = dados?.scope;
  const visao = visaoDoEscopo(scope);
  const comoCorretor = gestorVendoComoCorretor(scope, can('dashboard', 'team'));
  const primeiroNome = (user?.name || '').trim().split(' ')[0];
  const rotuloPeriodo = PERIODOS.find(p => p.valor === filtros.preset)?.rotulo ?? '';
  const periodo = rotuloPeriodo.toLowerCase();
  let subtitulo = rotuloPeriodo;
  if (dados) subtitulo = visao === 'corretor' ? `Seus números · ${periodo}` : `A imobiliária · ${periodo}`;
  const tentarDeNovo = () => { void recarregar(); };

  const ctx: ContextoBloco = useMemo(() => ({
    dados, carregando, visao, pode, filtros,
    abrirLista: (kind, titulo, limitado) => {
      setLista({ kind, titulo, limitado: !!limitado });
      setListaAberta(true);
    },
    mudarFunil: pipelineId => setFiltros(f => ({ ...f, pipelineId })),
  }), [dados, carregando, visao, pode, filtros]);

  let corpo: React.ReactNode;
  if (!dados && erro) {
    corpo = <GlassCard><EmptyState tipo="erro" aoTentarDeNovo={tentarDeNovo} /></GlassCard>;
  } else if (!dados) {
    corpo = <Esqueleto />;
  } else {
    corpo = linhasDaVisao(visao).map((linha, i) => (
      <React.Fragment key={i}>
        {linha.titulo && (
          <div className="lmfn-secao">
            <h2>{linha.titulo}</h2>
            {linha.subtitulo && <p>{linha.subtitulo}</p>}
          </div>
        )}
        <div className={`lmfn-linha${linha.principal ? ' lmfn-linha-principal' : ''}`}>
          {linha.colunas.map(coluna => (
            <div key={coluna.join('-')} className="lmfn-coluna">
              {coluna.map(id => {
                const Bloco = COMPONENTES[id];
                return <Bloco key={id} {...ctx} />;
              })}
            </div>
          ))}
        </div>
      </React.Fragment>
    ));
  }

  return (
    <div className="lmf">
      <Cabecalho
        nome={`${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ''}`}
        subtitulo={subtitulo}
        visao={visao}
        scope={scope}
        carregando={pendente}
        filtros={filtros}
        onFiltros={setFiltros}
      />

      {comoCorretor && (
        <div className="lmfn-aviso">
          <span>Você está vendo a Dashboard como um corretor vê: só os seus leads, visitas e imóveis.</span>
          <button type="button" onClick={() => setFiltros(f => ({ ...f, scope: scope?.available_modes.includes('all') ? 'all' : 'team' }))}>
            Voltar para a imobiliária
          </button>
        </div>
      )}

      {/* Erro com resposta antiga na mão: nunca mostrar número velho calado. */}
      {dados && erro && (
        <div className="lmfn-aviso lmfn-aviso-erro" role="alert">
          <span>Não deu para atualizar. Os números abaixo são da última vez.</span>
          <button type="button" onClick={tentarDeNovo}>Tentar de novo</button>
        </div>
      )}

      {/* Espaço do banner de campanhas da Leal Mídia (spec própria). Vazio. */}
      <div data-slot="banner" />

      {corpo}

      <ListaRapida
        aberta={listaAberta}
        kind={lista?.kind ?? null}
        titulo={lista?.titulo ?? ''}
        filtros={filtros}
        pode={pode}
        limitado={lista?.limitado}
        onFechar={() => setListaAberta(false)}
      />
    </div>
  );
};

export default DashboardNova;
