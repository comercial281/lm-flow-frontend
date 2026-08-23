import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/ds';

/**
 * Popup único de filtros do Pipeline (Quadro e Lista): unifica Tempo, Tags,
 * Largados e Colunas num só botão ancorado — mesmo padrão do popup de filtro
 * rápido do Chat (QuickFilters.tsx). Cada seção aplica na hora, sem botão
 * "Aplicar". Pedido do Giovani (20/08): eram 4 botões brigando por espaço na
 * barra; e "Largados" tinha o limiar de 7 dias fixo no código — agora dá pra
 * escolher (7/14/30/personalizado).
 */

export type TimePreset = 'all' | 'today' | '7d' | '30d' | 'custom';
export type AbandonedPreset = 'off' | '7' | '14' | '30' | 'custom';

interface TagOption {
  name: string;
  color: string;
}

interface StageOption {
  id: string;
  name: string;
  color: string;
}

interface PipelineFiltersPopoverProps {
  timePreset: TimePreset;
  onTimePresetChange: (preset: TimePreset) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;

  allTags: TagOption[];
  selectedTags: string[];
  onSelectedTagsChange: (tags: string[]) => void;

  abandonedPreset: AbandonedPreset;
  onAbandonedPresetChange: (preset: AbandonedPreset) => void;
  abandonedCustomDays: string;
  onAbandonedCustomDaysChange: (value: string) => void;

  stages: StageOption[];
  hiddenStages: string[];
  onHiddenStagesChange: (ids: string[]) => void;

  activeFilterCount: number;
  onClearAll: () => void;
}

const TIME_LABELS: Record<TimePreset, string> = {
  all: 'Todos',
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  custom: 'Período personalizado',
};

const ABANDONED_ORDER: AbandonedPreset[] = ['off', '7', '14', '30', 'custom'];

export default function PipelineFiltersPopover({
  timePreset,
  onTimePresetChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  allTags,
  selectedTags,
  onSelectedTagsChange,
  abandonedPreset,
  onAbandonedPresetChange,
  abandonedCustomDays,
  onAbandonedCustomDaysChange,
  stages,
  hiddenStages,
  onHiddenStagesChange,
  activeFilterCount,
  onClearAll,
}: PipelineFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  function toggleTag(name: string) {
    onSelectedTagsChange(
      selectedTags.includes(name) ? selectedTags.filter(t => t !== name) : [...selectedTags, name],
    );
  }

  function toggleStage(id: string) {
    onHiddenStagesChange(
      hiddenStages.includes(id) ? hiddenStages.filter(s => s !== id) : [...hiddenStages, id],
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center">
        <Button
          type="button"
          variant={activeFilterCount > 0 ? 'default' : 'outline'}
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className="whitespace-nowrap gap-1.5"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-background/30 px-1.5 text-xs">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            aria-label="Limpar todos os filtros"
            title="Limpar todos os filtros"
            className="ml-1 rounded p-1 text-muted-foreground transition hover:text-destructive cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Filtros do pipeline"
          className="absolute left-0 top-full z-30 mt-1 w-96 max-h-[80vh] overflow-y-auto rounded-lg border bg-popover p-3 shadow-lg"
        >
          {/* TEMPO (entrada do lead na etapa) */}
          <section>
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Tempo (entrada do lead)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TIME_LABELS) as TimePreset[]).map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onTimePresetChange(preset)}
                  className={`rounded border px-2 py-1 text-xs transition cursor-pointer ${
                    timePreset === preset
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {TIME_LABELS[preset]}
                </button>
              ))}
            </div>
            {timePreset === 'custom' && (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={e => onDateFromChange(e.target.value)}
                  className="flex-1 rounded border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={e => onDateToChange(e.target.value)}
                  className="flex-1 rounded border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>
            )}
          </section>

          {/* TAGS */}
          <section className="mt-2.5 border-t pt-2.5">
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            {allTags.length === 0 ? (
              <p className="px-0.5 py-1 text-xs text-muted-foreground">Nenhuma tag neste funil.</p>
            ) : (
              <div className="max-h-32 space-y-0.5 overflow-y-auto">
                {allTags.map(tag => {
                  const active = selectedTags.includes(tag.name);
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => toggleTag(tag.name)}
                      className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm transition cursor-pointer ${
                        active ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* LARGADOS — sem contato real (WhatsApp) há X dias, limiar escolhível */}
          <section className="mt-2.5 border-t pt-2.5">
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Largados (sem contato)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ABANDONED_ORDER.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onAbandonedPresetChange(preset)}
                  className={`rounded border px-2 py-1 text-xs transition cursor-pointer ${
                    abandonedPreset === preset
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {preset === 'off' ? 'Nenhum' : preset === 'custom' ? 'Personalizado…' : `${preset}+ dias`}
                </button>
              ))}
            </div>
            {abandonedPreset === 'custom' && (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={abandonedCustomDays}
                  onChange={e => onAbandonedCustomDaysChange(e.target.value)}
                  placeholder="Nº de dias"
                  className="w-24 rounded border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">dias sem contato</span>
              </div>
            )}
          </section>

          {/* COLUNAS (etapas visíveis no Quadro/Lista) */}
          <section className="mt-2.5 border-t pt-2.5">
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Colunas visíveis
            </p>
            <div className="max-h-32 space-y-0.5 overflow-y-auto">
              {stages.map(stage => {
                const visible = !hiddenStages.includes(stage.id);
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => toggleStage(stage.id)}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm transition cursor-pointer ${
                      visible ? 'hover:bg-muted' : 'text-muted-foreground/60 hover:bg-muted'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{stage.name}</span>
                    {visible && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
