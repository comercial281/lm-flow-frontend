import React, { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import type { PeriodPreset } from '../types';

/**
 * Seletor de período.
 *
 * Presets rápidos na barra e o resto num select, porque 17 botões lado a lado
 * não cabem e viram fila de scroll. "Personalizado" abre os dois campos de data
 * e só dispara a busca quando os DOIS estão preenchidos — senão cada tecla
 * digitada no ano faria uma request.
 */
const QUICK: { key: PeriodPreset; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'this_week', label: 'Semana' },
  { key: 'this_month', label: 'Mês' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'semester', label: 'Semestre' },
  { key: 'year', label: 'Ano' },
];

const MORE: { key: PeriodPreset; label: string }[] = [
  { key: 'yesterday', label: 'Ontem' },
  { key: 'last_7_days', label: 'Últimos 7 dias' },
  { key: 'last_30_days', label: 'Últimos 30 dias' },
  { key: 'last_90_days', label: 'Últimos 90 dias' },
  { key: 'last_week', label: 'Semana passada' },
  { key: 'last_month', label: 'Mês passado' },
  { key: 'last_quarter', label: 'Trimestre passado' },
  { key: 'last_semester', label: 'Semestre passado' },
  { key: 'last_year', label: 'Ano passado' },
  { key: 'all_time', label: 'Desde sempre' },
];

interface Props {
  preset: PeriodPreset;
  since?: string;
  until?: string;
  onChange: (next: { preset: PeriodPreset; since?: string; until?: string }) => void;
}

export const PeriodPicker: React.FC<Props> = ({ preset, since, until, onChange }) => {
  const [customOpen, setCustomOpen] = useState(preset === 'custom');
  const [draft, setDraft] = useState({ since: since || '', until: until || '' });

  const applyCustom = (next: { since: string; until: string }) => {
    setDraft(next);
    if (next.since && next.until) {
      onChange({ preset: 'custom', since: next.since, until: next.until });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="lmf-segment">
        {QUICK.map(p => (
          <button
            key={p.key}
            type="button"
            data-active={preset === p.key}
            onClick={() => {
              setCustomOpen(false);
              onChange({ preset: p.key });
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <select
        className="lmf-select"
        value={MORE.some(m => m.key === preset) ? preset : ''}
        onChange={e => {
          const value = e.target.value as PeriodPreset;
          if (!value) return;
          setCustomOpen(false);
          onChange({ preset: value });
        }}
        aria-label="Mais períodos"
      >
        <option value="">Mais períodos…</option>
        {MORE.map(p => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="lmf-select flex items-center gap-2"
        data-active={preset === 'custom'}
        onClick={() => setCustomOpen(v => !v)}
      >
        <CalendarRange size={14} />
        Personalizado
      </button>

      {customOpen && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="lmf-date-input"
            value={draft.since}
            max={draft.until || undefined}
            onChange={e => applyCustom({ ...draft, since: e.target.value })}
            aria-label="Data inicial"
          />
          <span className="text-xs" style={{ color: 'var(--lmf-muted)' }}>
            até
          </span>
          <input
            type="date"
            className="lmf-date-input"
            value={draft.until}
            min={draft.since || undefined}
            onChange={e => applyCustom({ ...draft, until: e.target.value })}
            aria-label="Data final"
          />
        </div>
      )}
    </div>
  );
};

export default PeriodPicker;
