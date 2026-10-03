// Só para testes: um resumo de mês completo, com o que o teste quiser trocar.
import type { CostsSummary } from '@/types/admin/costs';

export function fakeSummary(over: Partial<CostsSummary> = {}): CostsSummary {
  return {
    month: '2026-10', tenant: null, months: ['2026-10', '2026-09'],
    tenants: [{ schema: 'public', name: 'Leal Mídia (principal)' }, { schema: 'tenant_a', name: 'Alfa' }],
    rate: { value: 5, source: 'api' },
    totals: { ai_brl: 540, ai_usd: 108, structure_brl: 760, total_brl: 1300, calls: 900, errors: 3, unpriced: 0 },
    structure: [
      { provider: 'railway', label: 'Railway', usd: 86, brl: 430, launched: true },
      { provider: 'vercel', label: 'Vercel', usd: 46, brl: 230, launched: true },
      { provider: 'evolution', label: 'Evolution', usd: 20, brl: 100, launched: true },
    ],
    by_feature: [], by_model: [], by_tenant: [], daily: [], reconciliation: [],
    ...over,
  };
}
