import React, { useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, Cell, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart,
} from 'recharts';
import { CHART_COLORS, EmptyBlock, formatNumber, tooltipStyle } from './primitives';
import type { Granularity, HistoryBlock, SeriesBlock, SourcesBlock } from '../types';

/** Rótulo do eixo conforme o passo da série, resolvido no backend. */
const labelFor = (iso: string, granularity: Granularity) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  switch (granularity) {
    case 'hour':
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    case 'month':
      return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    case 'week':
      return `sem ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
    default:
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
};

/**
 * Série principal: leads, conversas e visitas no mesmo eixo, com a linha
 * tracejada do período anterior sobreposta por posição.
 *
 * O gráfico de conversas por dia que o Giovani já gostava vive aqui, agora com
 * a identidade nova e comparação com o período anterior.
 */
export const LeadsChart: React.FC<{ series: SeriesBlock }> = ({ series }) => {
  const data = useMemo(
    () =>
      series.buckets.map((bucket, i) => ({
        label: labelFor(bucket, series.granularity),
        leads: series.leads[i] ?? 0,
        conversas: series.conversations[i] ?? 0,
        visitas: series.visits[i] ?? 0,
        anterior: series.leads_previous[i] ?? 0,
      })),
    [series],
  );

  const hasMovement = data.some(d => d.leads || d.conversas || d.visitas);
  if (!hasMovement) return <EmptyBlock text="Nenhum movimento registrado neste período." />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="lmfLeads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--lmf-grid-line)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--lmf-muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis tick={{ fill: 'var(--lmf-muted)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <Tooltip {...tooltipStyle} formatter={(v?: number, n?: string) => [formatNumber(v ?? 0), String(n ?? "")] as [string, string]} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--lmf-muted)' }} />
        <Area type="monotone" dataKey="leads" name="Leads" stroke="#7c3aed" strokeWidth={2} fill="url(#lmfLeads)" />
        <Line type="monotone" dataKey="conversas" name="Conversas" stroke="#38bdf8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="visitas" name="Visitas" stroke="#34d399" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="anterior"
          name="Leads (período anterior)"
          stroke="#c4b5fd"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

/** Rosca de origem. O total no centro é o mesmo do KPI de leads, de propósito. */
export const SourcesDonut: React.FC<{ sources: SourcesBlock }> = ({ sources }) => {
  if (!sources.items?.length) return <EmptyBlock text="Nenhum lead captado neste período." />;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      <div className="relative" style={{ width: 190, height: 190, flex: 'none' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={sources.items} dataKey="count" nameKey="label" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="none">
              {sources.items.map((entry, i) => (
                <Cell key={entry.source} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v?: number, n?: string) => [formatNumber(v ?? 0), String(n ?? "")] as [string, string]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.02em' }}>{formatNumber(sources.total)}</div>
            {/* "captações", não "leads": o mesmo lead pode ser recapturado no
                período, então este total é maior que o card de leads novos. */}
            <div style={{ fontSize: 11, color: 'var(--lmf-muted)' }}>captações</div>
          </div>
        </div>
      </div>

      <ul className="flex-1 min-w-0">
        {sources.items.map((item, i) => (
          <li key={item.source} className="lmf-row">
            <span className="flex items-center gap-2 min-w-0">
              <span
                style={{
                  width: 9, height: 9, borderRadius: 999, flex: 'none',
                  background: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
              <span className="lmf-row-title truncate">{item.label}</span>
            </span>
            <span className="flex items-center gap-3 flex-none">
              <span style={{ fontSize: 12, color: 'var(--lmf-muted)' }}>{item.percent}%</span>
              <strong style={{ fontSize: 14 }}>{formatNumber(item.count)}</strong>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Histórico por ano — o "guarda métrica de todos os anos". Independe do filtro
 * de período selecionado, senão deixaria de ser histórico.
 */
export const HistoryChart: React.FC<{ history: HistoryBlock }> = ({ history }) => {
  if (!history.years?.length) return <EmptyBlock text="Sem histórico anual ainda." />;

  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={history.years} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="var(--lmf-grid-line)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="year" tick={{ fill: 'var(--lmf-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: 'var(--lmf-muted)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <Tooltip {...tooltipStyle} formatter={(v?: number) => [formatNumber(v ?? 0), "Leads"] as [string, string]} />
        <Bar dataKey="leads" fill="#7c3aed" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
