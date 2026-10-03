import { Bot, Server, Triangle, MessageCircle, Wallet } from 'lucide-react';
import BaseStatsGrid from '@/components/base/BaseStatsGrid';
import { dinheiro } from '@/lib/formato';
import type { CostsSummary } from '@/types/admin/costs';

const ICONE = { railway: Server, vercel: Triangle, evolution: MessageCircle } as const;

export default function CartoesDoMes({ summary }: { summary: CostsSummary }) {
  const filtrado = Boolean(summary.tenant);
  const cards = [
    { title: 'Total do mês', value: dinheiro(summary.totals.total_brl, { centavos: true }), icon: Wallet, valueFormat: 'custom' as const },
    { title: 'IA', value: dinheiro(summary.totals.ai_brl, { centavos: true }), icon: Bot, valueFormat: 'custom' as const },
    ...summary.structure.map((s) => ({
      title: s.label,
      icon: ICONE[s.provider],
      valueFormat: 'custom' as const,
      value: filtrado ? '—' : s.launched ? dinheiro(s.brl, { centavos: true }) : 'Não lançada',
      extra: filtrado ? <span className="text-xs text-muted-foreground">não é dividida por cliente</span> : undefined,
    })),
  ];
  return <BaseStatsGrid cards={cards} columns={5} />;
}
