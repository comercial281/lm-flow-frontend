import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft, Bot, CalendarClock, Clock, FileCheck, FileText, Flame, Hand, Home, Hourglass, Image as ImageIcon,
  LayoutTemplate, Loader2, MessageSquare, Mic, Repeat, Search, Shuffle, Sparkles, Star, Sticker, Users, Video, Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input,
} from '@/components/ui/ds';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation, FlowAutomationKind } from '@/types/flowAutomations';
import type { FlowTemplate, FlowTemplatePreviewStep } from '@/features/flowAutomations/templates';
import { describeMinutes, describeSeconds } from '@/features/flowAutomations/waitTime';
import { serverMessage } from '@/features/flowAutomations/guide';
import { BOOK_SOURCE, BOOK_SUMMARY } from '@/features/flowAutomations/book';
import { cn } from '@/lib/utils';

// JANELA DE MODELOS COM PRÉVIA (12/10/2026, escolha do dono entre duas versões
// desenhadas lado a lado): à esquerda a lista agrupada; à direita o modelo
// escolhido inteiro — quando começa, cada mensagem e espera, e o que ajustar
// antes de ligar. Serve pras Automações e pros Funis de mensagem. Grupo, ícone
// e "quando começa" vêm do servidor (FlowAutomations::Templates.summaries).
//
// No celular a janela mostra a lista; tocar num modelo abre a prévia, com
// "Todos os modelos" pra voltar.

const ICONS: Record<string, LucideIcon> = {
  repeat: Repeat, sparkles: Sparkles, users: Users, shuffle: Shuffle, 'calendar-clock': CalendarClock, bot: Bot,
  hand: Hand, home: Home, star: Star, 'file-check': FileCheck, flame: Flame, clock: Clock, 'file-text': FileText,
};

// A cor do ícone por grupo. Grupo novo sem cor cai no roxo da marca.
const TONES: Record<string, string> = {
  primeiro_contato: 'bg-chart-1/15 text-chart-1',
  abrir_conversa: 'bg-chart-1/15 text-chart-1',
  avisos: 'bg-chart-2/15 text-chart-2',
  imovel: 'bg-chart-2/15 text-chart-2',
  distribuicao: 'bg-chart-4/15 text-chart-4',
  visitas: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  depois_da_visita: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  recuperar: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
};
const tone = (category?: string) => TONES[category ?? ''] ?? TONES.primeiro_contato;
const iconOf = (t: FlowTemplate) => ICONS[t.icon ?? ''] ?? Zap;

const MEDIA: Record<string, { icon: LucideIcon; label: string }> = {
  image: { icon: ImageIcon, label: 'Foto' },
  video: { icon: Video, label: 'Vídeo' },
  document: { icon: FileText, label: 'Documento' },
  audio: { icon: Mic, label: 'Áudio' },
  sticker: { icon: Sticker, label: 'Figurinha' },
};
const ACTION_ICONS: Record<string, LucideIcon> = { notify_group: Users, assign_via_roleta: Shuffle };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Sem `kind`: os modelos das Automações. */
  kind?: FlowAutomationKind;
  title: string;
  description: string;
  /** Recebe o fluxo criado (desligado). */
  onApplied: (flow: FlowAutomation) => void;
  /** Modelo que abre escolhido (o cartão do estado vazio). */
  initialKey?: string | null;
  /** Texto do erro ao criar, quando o servidor não explica. */
  applyError?: string;
  /** Do lado esquerdo do rodapé (o "Começar do zero" do gestor). */
  footerStart?: ReactNode;
  /** Outra ação da janela em andamento: trava o "Usar este modelo". */
  busy?: boolean;
}

export function TemplatePickerDialog({
  open, onClose, kind, title, description, onApplied, initialKey, applyError = 'Não deu pra criar pelo modelo. Tente de novo.',
  footerStart, busy = false,
}: Props) {
  const [templates, setTemplates] = useState<FlowTemplate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [applying, setApplying] = useState(false);
  const loadId = useRef(0);

  const load = useCallback(() => {
    const id = ++loadId.current;
    setFailed(false);
    setTemplates(null);
    flowAutomationsService
      .templates(kind)
      .then(list => {
        if (id !== loadId.current) return;
        setTemplates(list);
        setSelected(cur => (cur && list.some(t => t.key === cur) ? cur : list[0]?.key ?? null));
      })
      .catch(() => { if (id === loadId.current) setFailed(true); });
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelected(initialKey ?? null);
    setShowDetail(Boolean(initialKey));
    load();
  }, [open, initialKey, load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!templates) return [];
    if (!q) return templates;
    return templates.filter(t => `${t.name} ${t.description} ${t.when ?? ''}`.toLowerCase().includes(q));
  }, [templates, search]);

  const groups = useMemo(() => {
    const out: { label: string; items: FlowTemplate[] }[] = [];
    for (const t of visible) {
      const label = t.category_label ?? '';
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(t);
      else out.push({ label, items: [t] });
    }
    return out;
  }, [visible]);

  const current = visible.find(t => t.key === selected) ?? visible[0] ?? null;

  const apply = async () => {
    if (!current || applying || busy) return;
    setApplying(true);
    try {
      onApplied(await flowAutomationsService.applyTemplate(current.key));
    } catch (e) {
      toast.error(serverMessage(e, applyError));
    } finally {
      setApplying(false);
    }
  };

  const choose = (key: string) => {
    setSelected(key);
    setShowDetail(true);
  };

  let body: ReactNode;
  if (failed) {
    body = <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={load} />;
  } else if (!templates) {
    body = <Carregando variante="lista" linhas={4} rotulo="Carregando os modelos…" />;
  } else if (templates.length === 0) {
    body = <EmptyState tamanho="compacto" icon={LayoutTemplate} title="Ainda não há modelos aqui." />;
  } else {
    body = (
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border border-border sm:grid-cols-[300px_minmax(0,1fr)]">
        <div className={cn('min-h-0 overflow-y-auto p-2 sm:border-r sm:border-border', showDetail && 'hidden sm:block')}>
          {visible.length === 0 ? (
            <EmptyState tipo="semResultado" tamanho="compacto" aoLimparFiltros={() => setSearch('')} />
          ) : (
            <div role="listbox" aria-label="Modelos">
              {groups.map(g => (
                <div key={g.label || 'sem-grupo'} role="group" aria-label={g.label || undefined}>
                  {g.label && (
                    <div className="px-2.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {g.label}
                    </div>
                  )}
                  {g.items.map(t => (
                    <TemplateRow key={t.key} template={t} selected={t.key === current?.key} onSelect={() => choose(t.key)} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={cn('min-h-0 overflow-y-auto', !showDetail && 'hidden sm:block')}>
          {current ? (
            <TemplateDetail template={current} onBack={() => setShowDetail(false)} />
          ) : (
            <div className="p-6"><EmptyState tipo="semResultado" tamanho="compacto" aoLimparFiltros={() => setSearch('')} /></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent size="wide" className="flex h-[min(860px,90dvh)] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" aria-hidden="true" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {templates && templates.length > 0 && (
            <div className={cn('relative', showDetail && 'hidden sm:block')}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar modelo…"
                aria-label="Buscar modelo"
                className="pl-9"
              />
            </div>
          )}
          {body}
        </div>

        <DialogFooter className="sm:justify-between">
          <div className="flex flex-col-reverse gap-2 sm:flex-row">{footerStart}</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={apply} disabled={!current || applying || busy}>
              {applying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Usar este modelo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateRow({ template, selected, onSelect }: { template: FlowTemplate; selected: boolean; onSelect: () => void }) {
  const Icon = iconOf(template);
  const pending = template.adjust?.some(a => a.pending);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-muted/60',
        selected && 'border-primary/25 bg-primary/10 hover:bg-primary/10',
      )}
    >
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tone(template.category))}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug">{template.name}</span>
        {template.when && <span className="block truncate text-xs text-muted-foreground">{template.when}</span>}
      </span>
      {pending && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Tem algo pra escolher antes de ligar">
          <span className="sr-only">Tem algo pra escolher antes de ligar</span>
        </span>
      )}
    </button>
  );
}

function TemplateDetail({ template, onBack }: { template: FlowTemplate; onBack: () => void }) {
  const Icon = iconOf(template);
  const steps = template.preview ?? [];
  const adjust = template.adjust ?? [];
  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6">
      <Button variant="ghost" size="sm" className="self-start sm:hidden" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Todos os modelos
      </Button>

      <div className="flex items-start gap-4">
        <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl', tone(template.category))}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          {template.category_label && (
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{template.category_label}</div>
          )}
          <h3 className="text-lg font-semibold leading-snug">{template.name}</h3>
          {template.description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{template.description}</p>}
        </div>
      </div>

      {(template.when || steps.length > 0) && (
        <section>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Como funciona</h4>
          <ol className="flex flex-col" aria-label={`Sequência do modelo ${template.name}`}>
            {template.when && (
              <FlowStep icon={Zap} trigger title={`Quando: ${template.when}`} last={steps.length === 0} />
            )}
            {steps.map((s, i) => <PreviewStep key={i} step={s} last={i === steps.length - 1} />)}
          </ol>
        </section>
      )}

      {adjust.length > 0 && (
        <section>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Antes de ligar, você ajusta
          </h4>
          <ol className="flex flex-col gap-2">
            {adjust.map((a, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    {a.pending && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  {a.hint && <p className="text-xs text-muted-foreground">{a.hint}</p>}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">O fluxo nasce desligado. Nada sai pro lead até você ligar.</p>
        </section>
      )}
    </div>
  );
}

function FlowStep({
  icon: Icon, title, subtitle, quote, branch, trigger = false, wait = false, last,
}: {
  icon: LucideIcon; title: string; subtitle?: string; quote?: ReactNode; branch?: string;
  trigger?: boolean; wait?: boolean; last: boolean;
}) {
  return (
    <li className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 pb-3">
      {!last && <span className="absolute bottom-0 left-[1.125rem] top-9 w-px bg-border" aria-hidden="true" />}
      <span
        className={cn(
          'relative z-[1] grid place-items-center border',
          wait ? 'm-1.5 h-6 w-6 rounded-full bg-background text-muted-foreground' : 'h-9 w-9 rounded-lg bg-muted/60 text-muted-foreground',
          trigger && 'border-transparent bg-primary text-primary-foreground',
        )}
      >
        <Icon className={wait ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      </span>
      <div className={cn('min-w-0', wait ? 'pt-2' : 'pt-1.5')}>
        {branch && (
          <span className="mb-1 inline-block rounded-full border border-dashed px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {branch}
          </span>
        )}
        <div className={cn('text-sm', wait ? 'text-muted-foreground' : 'font-medium')}>{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        {quote}
      </div>
    </li>
  );
}

function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 max-w-md whitespace-pre-line rounded-xl rounded-tl-sm bg-muted/60 px-3 py-2 text-[13px] leading-relaxed">
      {children}
    </div>
  );
}

function PreviewStep({ step, last }: { step: FlowTemplatePreviewStep; last: boolean }) {
  const branch = step.branch === 'no_reply' ? 'Se não responder' : undefined;
  if (step.kind === 'wait') {
    return <FlowStep icon={Clock} wait title={`Espera ${describeSeconds(step.seconds ?? 0)}`} branch={branch} last={last} />;
  }
  if (step.kind === 'wait_for_reply') {
    return (
      <FlowStep icon={Hourglass} wait title={`Aguarda a resposta por ${describeMinutes(step.minutes ?? 0)}`} branch={branch} last={last} />
    );
  }
  if (step.kind === 'lead_action') {
    return (
      <FlowStep
        icon={ACTION_ICONS[step.action_type ?? ''] ?? Zap}
        title={step.label || 'Ação no lead'}
        quote={step.text ? <Bubble>{step.text}</Bubble> : undefined}
        branch={branch}
        last={last}
      />
    );
  }
  if (step.kind === 'hand_to_ai') {
    return <FlowStep icon={Bot} title="Passa a conversa pra IA" branch={branch} last={last} />;
  }
  if (step.kind === 'send_whatsapp') {
    const media = step.media_kind ? MEDIA[step.media_kind] : undefined;
    const book = step.media_source === BOOK_SOURCE;
    const subtitle = [
      step.send_from === 'owner' ? 'Pelo número do responsável' : undefined,
      media && !step.text ? `${media.label}: você escolhe` : undefined,
      book ? BOOK_SUMMARY : undefined,
    ].filter(Boolean).join(' · ');
    return (
      <FlowStep
        icon={book ? FileText : media?.icon ?? MessageSquare}
        title={step.label || (media ? media.label : 'Mensagem')}
        subtitle={subtitle || undefined}
        quote={step.text ? <Bubble>{step.text}</Bubble> : undefined}
        branch={branch}
        last={last}
      />
    );
  }
  return <FlowStep icon={Zap} title={step.label || 'Outro passo'} branch={branch} last={last} />;
}
