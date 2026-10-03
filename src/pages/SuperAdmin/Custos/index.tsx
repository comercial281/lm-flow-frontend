import { useCallback, useEffect, useRef, useState } from 'react';
import AdminConteudo from '@/pages/Admin/Area/AdminConteudo';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { costsService } from '@/services/superAdmin/costsService';
import type { CostsSummary } from '@/types/admin/costs';
import CartoesDoMes from './CartoesDoMes';
import Conferencia from './Conferencia';
import Recortes from './Recortes';
import { rotuloMes } from './formatoCustos';

// Clientes → Custos. Uma régua só pro dinheiro do LM Flow: IA exata (registro de
// chamadas) + estrutura lançada à mão. Spec: LM FLOW/specs/2026-10-03-admin-registro-custos-usuarios-design.md
const TODOS = '__todos__';

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Custos() {
  const [month, setMonth] = useState(mesAtual);
  const [tenant, setTenant] = useState<string | null>(null);
  const [summary, setSummary] = useState<CostsSummary | null>(null);
  // A janela de lançar fatura é a Task F5; até lá só guardamos o pedido.
  const [, setLancando] = useState(false);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');

  // Só a última chamada vale: resposta atrasada de filtro antigo não sobrescreve a atual.
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setEstado('carregando');
    try {
      const dados = await costsService.summary({ month, tenant });
      if (minha !== seq.current) return;
      setSummary(dados);
      setEstado('pronto');
    } catch {
      if (minha !== seq.current) return;
      setEstado('erro');
    }
  }, [month, tenant]);

  useEffect(() => { void carregar(); }, [carregar]);

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
            <Seletor aria-label="Cliente" value={tenant ?? TODOS} onChange={(e) => setTenant(e.target.value === TODOS ? null : e.target.value)} className="w-64">
              <option value={TODOS}>Todos os clientes</option>
              {(summary?.tenants ?? []).map((t) => <option key={t.schema} value={t.schema}>{t.name}</option>)}
            </Seletor>
          </label>
        </div>

        {estado === 'erro' && (
          <EmptyState tipo="erro" title="Não deu para carregar os custos" aoTentarDeNovo={carregar} />
        )}

        {estado === 'carregando' && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
          </div>
        )}

        {estado === 'pronto' && summary && (
          <>
            <CartoesDoMes summary={summary} />
            <div data-testid="custos-detalhes" className="flex flex-col gap-6">
              <Recortes summary={summary} />
              {!summary.tenant && <Conferencia reconciliation={summary.reconciliation} aoLancar={() => setLancando(true)} />}
            </div>
          </>
        )}
      </div>
    </AdminConteudo>
  );
}
