import React from 'react';
import { Users, MessageSquare, CalendarCheck, DollarSign, FileText, Trophy, Receipt, CheckCircle2 } from 'lucide-react';
import { Delta, formatCurrency, formatNumber, Skeleton } from './primitives';
import type { KpiKey, Kpis } from '../types';

const DEFS: { key: KpiKey; label: string; icon: React.ReactNode; money?: boolean }[] = [
  { key: 'leads', label: 'Leads captados', icon: <Users size={15} /> },
  { key: 'conversations', label: 'Conversas únicas', icon: <MessageSquare size={15} /> },
  { key: 'visits_scheduled', label: 'Visitas agendadas', icon: <CalendarCheck size={15} /> },
  { key: 'visits_done', label: 'Visitas atendidas', icon: <CheckCircle2 size={15} /> },
  { key: 'proposals', label: 'Propostas', icon: <FileText size={15} /> },
  { key: 'sales', label: 'Vendas concretizadas', icon: <Trophy size={15} /> },
  { key: 'vgv', label: 'VGV', icon: <DollarSign size={15} />, money: true },
  { key: 'ticket', label: 'Ticket médio', icon: <Receipt size={15} />, money: true },
];

export const KpiRow: React.FC<{ kpis?: Kpis; loading?: boolean }> = ({ kpis, loading }) => {
  if (loading || !kpis) {
    return (
      <div className="lmf-grid lmf-grid-kpi">
        {DEFS.map(d => (
          <Skeleton key={d.key} height={140} />
        ))}
      </div>
    );
  }

  return (
    <div className="lmf-grid lmf-grid-kpi">
      {DEFS.map(def => {
        const kpi = kpis[def.key];
        if (!kpi) return null;
        return (
          <article key={def.key} className="lmf-glass lmf-card">
            <div className="lmf-kpi-label">
              <span className="lmf-kpi-icon">{def.icon}</span>
              {def.label}
            </div>
            <p className="lmf-kpi-value">{def.money ? formatCurrency(kpi.value) : formatNumber(kpi.value)}</p>
            <Delta value={kpi.delta} />
          </article>
        );
      })}
    </div>
  );
};

export default KpiRow;
