import { useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import AdminConteudo from '@/pages/Admin/Area/AdminConteudo';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { costsService } from '@/services/superAdmin/costsService';
import type { CostsSummary } from '@/types/admin/costs';
import { Button } from '@/components/ui/ds';
import CartoesDoMes from './CartoesDoMes';
import Conferencia from './Conferencia';
import LancarFaturas from './LancarFaturas';
import ListaDeChamadas from './ListaDeChamadas';
import Recortes from './Recortes';
import { rotuloMes } from './formatoCustos';
import CambioDasContas from './CambioDasContas';
import Margem from './Margem';

// Clientes → Custos. Uma régua só pro dinheiro do LM Flow: IA exata (registro de
// chamadas) + estrutura lançada à mão. Spec: LM FLOW/specs/2026-10-03-admin-registro-custos-usuarios-design.md
const TODOS = '__todos__';
const TODAS = '__todas__';

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Custos() {
  const [month, setMonth] = useState(mesAtual);
  const [params] = useSearchParams();
  const [tenant, setTenant] = useState<string | null>(() => params.get('tenant'));
  // IA do cliente filtrado; trocar de cliente limpa (a IA é de um cliente só).
  const [agent, setAgent] = useState<string | null>(null);
  // Soma 1 quando o câmbio das contas muda: lista (e margem) buscam de novo.
  // Filtro Avulso/Performance da Margem: mora aqui para sobreviver à troca de mês/cliente.
  const [kindDaMargem, setKindDaMargem] = useState('todos');
  const [recarga, setRecarga] = useState(0);
  // `so_erros` do endereço vale só na primeira carga; depois manda a escolha da pessoa.
  const [soErros, setSoErros] = useState(() => params.get('so_erros') === '1');
  const [summary, setSummary] = useState<CostsSummary | null>(null);
  const [lancando, setLancando] = useState(false);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');

  // Só a última chamada vale: resposta atrasada de filtro antigo não sobrescreve a atual.
  const seq = useRef(0);

  // `silencioso`: recarga depois de salvar faturas. Mantém o resumo atual na tela (sem
  // skeleton) pra lista não perder filtro/página nem a rolagem pular. Mês/cliente usam o skeleton.
  const carregar = useCallback(async (silencioso = false) => {
    const minha = ++seq.current;
    if (!silencioso) setEstado('carregando');
    try {
      const dados = await costsService.summary({ month, tenant, agent });
      if (minha !== seq.current) return;
      setSummary(dados);
      setEstado('pronto');
    } catch {
      if (minha !== seq.current) return;
      setEstado('erro');
    }
  }, [month, tenant, agent]);

  useEffect(() => { void carregar(); }, [carregar]);

  // IA escolhida que sumiu das opções do cliente (apagada, ou id torto): volta para "Todas as IAs".
  useEffect(() => {
    if (agent && summary && summary.tenant === tenant && !summary.agents.some((a) => a.id === agent)) setAgent(null);
  }, [agent, summary, tenant]);

  return (
    <AdminConteudo>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Mês</span>
            <Seletor aria-label="Mês" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48">
              {(summary?.months.includes(month) ? summary.months : [month, ...(summary?.months ?? [])]).map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
            </Seletor>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Cliente</span>
            <Seletor aria-label="Cliente" value={tenant ?? TODOS} onChange={(e) => { setTenant(e.target.value === TODOS ? null : e.target.value); setAgent(null); }} className="w-64">
              <option value={TODOS}>Todos os clientes</option>
              {(summary?.tenants ?? []).map((t) => <option key={t.schema} value={t.schema}>{t.name}</option>)}
            </Seletor>
          </label>
          {tenant && summary && summary.tenant === tenant && summary.agents.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">IA</span>
              <Seletor aria-label="IA" value={agent ?? TODAS} onChange={(e) => setAgent(e.target.value === TODAS ? null : e.target.value)} className="w-56">
                <option value={TODAS}>Todas as IAs</option>
                {summary.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Seletor>
            </label>
          )}
          <CambioDasContas aoMudar={() => { void carregar(true); setRecarga((n) => n + 1); }} />
          <Button className="ml-auto" variant="outline" onClick={() => setLancando(true)}>Lançar faturas do mês</Button>
        </div>

        {estado === 'erro' && (
          <EmptyState tipo="erro" title="Não deu para carregar os custos" aoTentarDeNovo={() => void carregar()} />
        )}

        {estado === 'carregando' && (
          // Mesmas classes do BaseStatsGrid (5 colunas) + placeholders do que vem depois: sem salto de layout.
          <div aria-busy="true" className="flex flex-col gap-6">
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[74px] animate-pulse rounded-lg bg-muted" />)}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />)}
            </div>
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          </div>
        )}

        {estado === 'pronto' && summary && (
          <>
            <CartoesDoMes summary={summary} />
            {/* Margem é da carteira: só em "Todos os clientes" (com cliente filtrado a estrutura não é dividida). */}
            {!summary.tenant && <Margem month={month} kind={kindDaMargem} aoMudarKind={setKindDaMargem} recarga={recarga} aoLancar={() => setLancando(true)} />}
            <div data-testid="custos-detalhes" className="flex flex-col gap-6">
              <Recortes summary={summary} />
              {!summary.tenant && <Conferencia reconciliation={summary.reconciliation} aoLancar={() => setLancando(true)} />}
              <ListaDeChamadas month={month} tenant={tenant} agent={agent} recarga={recarga} funcoes={summary.by_feature} soErrosInicial={soErros} aoMudarSoErros={setSoErros} />
            </div>
          </>
        )}
      </div>
      <LancarFaturas month={month} aberta={lancando} aoFechar={() => setLancando(false)} aoSalvar={() => { void carregar(true); setRecarga((n) => n + 1); }} />
    </AdminConteudo>
  );
}
