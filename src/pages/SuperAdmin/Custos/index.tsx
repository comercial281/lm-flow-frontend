import { useCallback, useEffect, useState } from 'react';
import AdminConteudo from '@/pages/Admin/Area/AdminConteudo';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { costsService } from '@/services/superAdmin/costsService';
import type { CostsSummary } from '@/types/admin/costs';
import CartoesDoMes from './CartoesDoMes';
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
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');

  const carregar = useCallback(async () => {
    setEstado('carregando');
    try {
      setSummary(await costsService.summary({ month, tenant }));
      setEstado('pronto');
    } catch {
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
              {(summary?.months ?? [month]).map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
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

        {estado === 'carregando' && !summary && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
          </div>
        )}

        {estado !== 'erro' && summary && (
          <>
            <CartoesDoMes summary={summary} />
            <div data-testid="custos-detalhes" className="flex flex-col gap-6" />
          </>
        )}
      </div>
    </AdminConteudo>
  );
}
