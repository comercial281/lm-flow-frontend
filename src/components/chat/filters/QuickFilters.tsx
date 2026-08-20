import { useEffect, useRef, useState } from 'react';
import { Bot, Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@evoapi/design-system/button';
import chatService from '@/services/chat/chatService';
import type { Label } from '@/types/chat/api';
import type { BaseFilter } from '@/types/core';

/**
 * O POPUP DE FILTRO — não o modal de 4xl.
 *
 * O botão "Filtros" abria um Dialog centralizado de largura `max-w-4xl`: um
 * construtor de regra (atributo + operador + valor) pensado pra filtro
 * avançado, ocupando a tela toda pra escolher uma tag. Pedido do Giovani
 * (19/08): um popup NORMAL, ancorado no botão, com as três coisas que ele
 * usa toda hora — tag, instância, período — resolvidas com um clique. O
 * resto (status, time, pipeline, prioridade) continua existindo no modal
 * antigo, um clique adiante em "Filtros avançados".
 *
 * Cada seção aplica na hora (mesmo padrão do `FiltrosDeConversa` do LM Hub):
 * sem botão "Aplicar" pra tag e instância — clicar já filtra. Período é a
 * exceção que confirma a regra: `<input type="date">` só dispara `onChange`
 * quando a data está completa, então aplicar na hora também é seguro ali —
 * não é campo de texto disparando request por tecla.
 */

interface InboxOption {
  id: string;
  label: string;
  /** A IA está operando nesta instância (bot ligado — ver `Inbox#active_bot?`). */
  iaAtiva?: boolean;
}

interface QuickFiltersProps {
  /** Filtros já aplicados (mesmo array que alimenta o modal avançado). */
  filters: BaseFilter[];
  /** Instâncias (WhatsApp) do tenant — só mostra a seção com 2+. */
  inboxOptions: InboxOption[];
  onApply: (next: BaseFilter[]) => void;
  onOpenAdvanced: () => void;
}

// Os atributos que SÓ o modal avançado resolve — servem pra contar quantos
// filtros "escondidos" estão ativos sem duplicar a lógica deles aqui.
const ADVANCED_ONLY_KEYS = new Set([
  'status',
  'assignee_type',
  'team_id',
  'channel_type',
  'priority',
  'pipeline_id',
  'pipeline_stage_id',
  'created_at',
]);

function mkFilter(attributeKey: string, filterOperator: string, values: string): BaseFilter {
  return { attributeKey, filterOperator, values, queryOperator: 'and', attributeModel: 'standard' };
}

// `toISOString` desloca pro fuso UTC e pode voltar um dia — `en-CA` dá
// YYYY-MM-DD direto no fuso local, que é o que o `<input type="date">` e o
// backend (`::date`) esperam.
function isoDate(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

export default function QuickFilters({
  filters,
  inboxOptions,
  onApply,
  onOpenAdvanced,
}: QuickFiltersProps) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || labels.length > 0) return;
    let alive = true;
    setLoadingLabels(true);
    chatService
      .getAvailableLabels()
      .then(res => {
        if (!alive) return;
        const list = Array.isArray(res) ? res : (res as { data?: Label[] })?.data || [];
        setLabels(list);
      })
      .catch(() => { /* silencioso, seção fica vazia */ })
      .finally(() => { if (alive) setLoadingLabels(false); });
    return () => { alive = false; };
  }, [open, labels.length]);

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

  const activeTagFilter = filters.find(f => f.attributeKey === 'labels');
  const activeTagTitle = activeTagFilter ? String(activeTagFilter.values) : undefined;

  const activeInboxFilter = filters.find(f => f.attributeKey === 'inbox_id');
  const activeInboxId = activeInboxFilter ? String(activeInboxFilter.values) : undefined;

  const startFilter = filters.find(
    f => f.attributeKey === 'last_activity_at' && f.filterOperator === 'is_greater_than',
  );
  const endFilter = filters.find(
    f => f.attributeKey === 'last_activity_at' && f.filterOperator === 'is_less_than',
  );
  const startDate = startFilter ? String(startFilter.values) : '';
  const endDate = endFilter ? String(endFilter.values) : '';

  const advancedCount = filters.filter(f => ADVANCED_ONLY_KEYS.has(f.attributeKey)).length;
  const totalActive =
    (activeTagTitle ? 1 : 0) +
    (activeInboxId ? 1 : 0) +
    (startDate || endDate ? 1 : 0) +
    advancedCount;

  function withoutKeys(keys: string[]): BaseFilter[] {
    return filters.filter(f => !keys.includes(f.attributeKey));
  }

  function applyTag(title: string | undefined) {
    const base = withoutKeys(['labels']);
    onApply(title ? [...base, mkFilter('labels', 'equal_to', title)] : base);
  }

  function applyInbox(id: string | undefined) {
    const base = withoutKeys(['inbox_id']);
    onApply(id ? [...base, mkFilter('inbox_id', 'equal_to', id)] : base);
  }

  function applyPeriod(nextStart: string, nextEnd: string) {
    const base = withoutKeys(['last_activity_at']);
    const next = [...base];
    if (nextStart) next.push(mkFilter('last_activity_at', 'is_greater_than', nextStart));
    if (nextEnd) next.push(mkFilter('last_activity_at', 'is_less_than', nextEnd));
    onApply(next);
  }

  function applyPreset(days: number) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    applyPeriod(isoDate(start), '');
  }

  function clearAll() {
    onApply(withoutKeys(['labels', 'inbox_id', 'last_activity_at']));
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className={`h-8 px-2 gap-1.5 cursor-pointer ${totalActive > 0 ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {totalActive > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[11px] tabular-nums">
              {totalActive}
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>

        {totalActive > 0 && (
          <button
            type="button"
            onClick={clearAll}
            aria-label="Limpar tag, instância e período"
            title="Limpar tag, instância e período"
            className="rounded p-1 text-muted-foreground transition hover:text-destructive cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Filtros rápidos"
          className="absolute left-0 top-full z-30 mt-1 w-80 rounded-lg border bg-popover p-3 shadow-lg"
        >
          {/* TAGS */}
          <section>
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            {loadingLabels ? (
              <p className="px-0.5 py-1.5 text-xs text-muted-foreground">Carregando…</p>
            ) : labels.length === 0 ? (
              <p className="px-0.5 py-1.5 text-xs text-muted-foreground">
                Nenhuma tag criada ainda.
              </p>
            ) : (
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
                {labels.map(l => {
                  const active = activeTagTitle === l.title;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => applyTag(active ? undefined : l.title)}
                      className={`flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left text-sm transition cursor-pointer ${
                        active ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: l.color || '#999' }}
                        />
                        <span className="truncate">{l.title}</span>
                      </span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* INSTÂNCIA — só com 2+, uma só não é filtro, é a caixa inteira */}
          {inboxOptions.length > 1 && (
            <section className="mt-2 border-t pt-2">
              <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Instância
              </p>
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
                {inboxOptions.map(i => {
                  const active = activeInboxId === i.id;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => applyInbox(active ? undefined : i.id)}
                      className={`flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left text-sm transition cursor-pointer ${
                        active ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{i.label}</span>
                      {/* IA ATIVA NESTA INSTÂNCIA — pedido do Giovani (19/08):
                          ver de relance em qual chip a IA está respondendo,
                          sem abrir Configurações → Canais pra checar um por
                          um. Aparece em CADA instância com bot ligado — se a
                          IA opera em três chips, os três mostram o ícone. */}
                      {i.iaAtiva && (
                        <span title="IA ativa nesta instância" className="shrink-0">
                          <Bot aria-label="IA ativa nesta instância" className="h-3.5 w-3.5 text-[#9333EA]" />
                        </span>
                      )}
                      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* PERÍODO — presets rápidos + intervalo manual, os dois na mesma
              coluna `last_activity_at` (última mensagem), que é o que
              importa numa caixa de conversa — não `created_at`. */}
          <section className="mt-2 border-t pt-2">
            <p className="mb-1 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Período
            </p>
            <div className="mb-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset(0)}
                className="flex-1 cursor-pointer rounded border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => applyPreset(7)}
                className="flex-1 cursor-pointer rounded border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                7 dias
              </button>
              <button
                type="button"
                onClick={() => applyPreset(30)}
                className="flex-1 cursor-pointer rounded border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                30 dias
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="flex-1 text-xs text-muted-foreground">
                De
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={e => applyPeriod(e.target.value, endDate)}
                  className="mt-0.5 w-full rounded border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="flex-1 text-xs text-muted-foreground">
                Até
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={e => applyPeriod(startDate, e.target.value)}
                  className="mt-0.5 w-full rounded border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
              </label>
            </div>
          </section>

          <div className="mt-2 border-t pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenAdvanced();
              }}
              className="w-full cursor-pointer px-0.5 py-1 text-left text-xs text-muted-foreground transition hover:text-foreground"
            >
              Filtros avançados{advancedCount > 0 ? ` (${advancedCount})` : ''}…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
