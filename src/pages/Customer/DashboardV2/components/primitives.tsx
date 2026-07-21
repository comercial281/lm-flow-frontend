import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { Unavailable } from '../types';

/** Card de vidro. Toda seção do dash usa este, então o visual não diverge. */
export const GlassCard: React.FC<{
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, action, className = '', bodyClassName = '', children }) => (
  <section className={`lmf-glass lmf-card ${className}`}>
    {(title || action) && (
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          {title && <h2 className="lmf-card-title">{title}</h2>}
          {subtitle && <p className="lmf-card-sub">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    <div className={bodyClassName}>{children}</div>
  </section>
);

/**
 * Bloco sem dado. Mostra o MOTIVO em vez de zero: um gráfico zerado é lido como
 * "não teve movimento", que é uma afirmação falsa quando na verdade não existe
 * fonte de dado.
 */
export const EmptyBlock: React.FC<{ block?: Unavailable; text?: string }> = ({ block, text }) => {
  const reasons: Record<string, string> = {
    no_source: 'Sem fonte de dados conectada.',
    no_table: 'Ainda não há histórico registrado para este período.',
    no_pipeline: 'Nenhum pipeline ativo encontrado.',
    error: 'Não foi possível calcular este bloco.',
  };
  const message = text || block?.message || reasons[block?.reason || ''] || 'Sem dados no período.';

  return (
    <div className="lmf-empty">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  );
};

export const Skeleton: React.FC<{ height?: number; className?: string }> = ({ height = 120, className = '' }) => (
  <div className={`lmf-skeleton ${className}`} style={{ height }} />
);

/** Delta com seta. `null` = não havia base de comparação (dividir por zero não é -100%). */
export const Delta: React.FC<{ value: number | null; suffix?: string }> = ({ value, suffix = 'vs. período anterior' }) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="lmf-kpi-delta lmf-flat">sem base de comparação</span>;
  }
  const tone = value > 0 ? 'lmf-up' : value < 0 ? 'lmf-down' : 'lmf-flat';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '■';
  return (
    <span className={`lmf-kpi-delta ${tone}`}>
      {arrow} {Math.abs(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% {suffix}
    </span>
  );
};

const numberFmt = new Intl.NumberFormat('pt-BR');
const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const formatNumber = (value: number) => numberFmt.format(Math.round(value || 0));

/** Valores grandes viram 1,8 mi: o card do protótipo não comporta R$ 1.800.000,00. */
export const formatCurrency = (value: number) => {
  const v = value || 0;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return currencyFmt.format(v);
};

export const formatDuration = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  if (s < 86400) return `${(s / 3600).toFixed(1).replace('.', ',')}h`;
  return `${(s / 86400).toFixed(1).replace('.', ',')}d`;
};

export const tooltipStyle = {
  contentStyle: {
    background: 'rgba(12,5,26,0.96)',
    border: '1px solid #2a1b49',
    borderRadius: 10,
    fontSize: 12,
    color: '#f2effa',
  },
  labelStyle: { color: '#a394c7', marginBottom: 4 },
  itemStyle: { color: '#f2effa' },
};

export const CHART_COLORS = ['#7c3aed', '#34d399', '#38bdf8', '#fbbf24', '#fb7185', '#c4b5fd', '#f472b6', '#22d3ee'];
