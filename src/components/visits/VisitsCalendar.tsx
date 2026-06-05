import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Building2,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  addMonths,
  startOfMonth,
  startOfDay,
  isSameDay,
  isToday as isTodayFn,
  isSameMonth,
  differenceInMinutes,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { View, SlotInfo } from 'react-big-calendar';

import './visits-calendar.css';

import type { Visit } from '@/services/visits/visitsService';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Visit;
}

const STATUS: Record<string, { label: string; varName: string }> = {
  scheduled:   { label: 'Agendada',    varName: '--status-scheduled' },
  confirmed:   { label: 'Confirmada',  varName: '--status-confirmed' },
  in_progress: { label: 'Em andamento',varName: '--status-in_progress' },
  completed:   { label: 'Realizada',   varName: '--status-completed' },
  no_show:     { label: 'No-show',     varName: '--status-no_show' },
  cancelled:   { label: 'Cancelada',   varName: '--status-cancelled' },
  rescheduled: { label: 'Reagendada',  varName: '--status-rescheduled' },
};

interface Props {
  visits: Visit[];
  view: View;
  date: Date;
  onView: (v: View) => void;
  onNavigate: (d: Date) => void;
  onSelectSlot: (slot: SlotInfo) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onReschedule?: (visit: Visit, newStart: Date) => void;
}

/* ───────────────────────── helpers ───────────────────────── */

const weekStart = (d: Date) => startOfWeek(d, { locale: ptBR, weekStartsOn: 1 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toEvent(v: Visit): CalendarEvent {
  const start = new Date(v.scheduled_at);
  const end = new Date(start.getTime() + (v.duration_minutes ?? 60) * 60000);
  const title = v.property?.title
    ? `${v.property.title} • ${v.contact?.name ?? 'Sem contato'}`
    : v.contact?.name ?? 'Visita';
  return { id: v.id, title, start, end, resource: v };
}

/* ───────────────────────── component ───────────────────────── */

export function VisitsCalendar({
  visits,
  view,
  date,
  onView,
  onNavigate,
  onSelectSlot,
  onSelectEvent,
  onReschedule,
}: Props) {
  const events = useMemo(() => visits.map(toEvent), [visits]);

  /* current-time tick para a linha "agora" */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const goToday = () => onNavigate(new Date());

  const goPrev = () => {
    if (view === 'month') onNavigate(addMonths(date, -1));
    else if (view === 'week') onNavigate(addWeeks(date, -1));
    else onNavigate(addDays(date, -1));
  };
  const goNext = () => {
    if (view === 'month') onNavigate(addMonths(date, 1));
    else if (view === 'week') onNavigate(addWeeks(date, 1));
    else onNavigate(addDays(date, 1));
  };

  /* título do range no header */
  const headerLabel = useMemo(() => {
    if (view === 'day') {
      return cap(format(date, "EEEE',' d 'de' MMMM", { locale: ptBR }));
    }
    if (view === 'month') {
      return cap(format(date, "MMMM", { locale: ptBR }));
    }
    const start = weekStart(date);
    const end = addDays(start, 6);
    if (isSameMonth(start, end)) {
      return `${format(start, "d", { locale: ptBR })}–${format(end, "d 'de' MMMM", { locale: ptBR })}`;
    }
    return `${format(start, "d 'de' MMM", { locale: ptBR })} – ${format(end, "d 'de' MMM", { locale: ptBR })}`;
  }, [date, view]);

  const yearLabel = format(date, 'yyyy');

  return (
    <div className="visits-cal relative flex h-full flex-col">
      {/* Background mesh + noise */}
      <div className="visits-cal-bg visits-cal-noise pointer-events-none absolute inset-0 -z-10 rounded-3xl" />

      {/* Toolbar editorial */}
      <header className="mb-7 flex flex-wrap items-end justify-between gap-6 px-1">
        <div className="flex items-end gap-5">
          <div className="flex flex-col">
            <span className="visits-cal-font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              {yearLabel} · Agenda
            </span>
            <h2 className="visits-cal-font-display mt-1 text-[44px] font-light leading-[0.95] tracking-tight text-foreground sm:text-[56px]">
              {headerLabel}
            </h2>
          </div>

          <div className="mb-2 flex items-center gap-1.5">
            <button
              onClick={goPrev}
              className="grid h-9 w-9 place-items-center rounded-full border border-border/70 text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={goNext}
              className="grid h-9 w-9 place-items-center rounded-full border border-border/70 text-muted-foreground transition hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
              aria-label="Próximo"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={goToday}
              className="visits-cal-font-mono ml-2 inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 px-3.5 text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
            >
              <Sparkles className="h-3 w-3" />
              Hoje
            </button>
          </div>
        </div>

        <div className="visits-cal-font-mono mb-2 inline-flex items-center gap-1 rounded-full border border-border/70 p-1 text-[10px] uppercase tracking-[0.24em]">
          {(['month', 'week', 'day'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => onView(v)}
              className={
                'rounded-full px-3.5 py-1.5 transition ' +
                (view === v
                  ? 'bg-primary text-primary-foreground shadow-[0_6px_20px_-8px_var(--primary)]'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Dia'}
            </button>
          ))}
        </div>
      </header>

      {/* Body por view */}
      <div className="relative flex-1 overflow-hidden">
        {view === 'week' && (
          <WeekView
            anchor={date}
            events={events}
            now={now}
            onSelectSlot={onSelectSlot}
            onSelectEvent={onSelectEvent}
            onReschedule={onReschedule}
          />
        )}
        {view === 'day' && (
          <DayView
            date={date}
            events={events}
            now={now}
            onSelectSlot={onSelectSlot}
            onSelectEvent={onSelectEvent}
          />
        )}
        {view === 'month' && (
          <MonthView
            anchor={date}
            events={events}
            onSelectDay={(d) => {
              onNavigate(d);
              onView('day');
            }}
            onSelectEvent={onSelectEvent}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── WEEK ───────────────────────── */

function WeekView({
  anchor,
  events,
  now,
  onSelectSlot,
  onSelectEvent,
  onReschedule,
}: {
  anchor: Date;
  events: CalendarEvent[];
  now: Date;
  onSelectSlot: Props['onSelectSlot'];
  onSelectEvent: Props['onSelectEvent'];
  onReschedule: Props['onReschedule'];
}) {
  const days = useMemo(() => {
    const s = weekStart(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [anchor]);

  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragData = useRef<{ visit: Visit; sourceHour: number; sourceMin: number } | null>(null);

  const handleDragStart = (e: React.DragEvent, visit: Visit) => {
    const d = new Date(visit.scheduled_at);
    dragData.current = { visit, sourceHour: d.getHours(), sourceMin: d.getMinutes() };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', visit.id);
  };

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDragOver(null);
    const data = dragData.current;
    if (!data || !onReschedule) return;
    const next = new Date(day);
    next.setHours(data.sourceHour, data.sourceMin, 0, 0);
    if (next.getTime() === new Date(data.visit.scheduled_at).getTime()) return;
    onReschedule(data.visit, next);
    dragData.current = null;
  };

  return (
    <div className="grid h-full grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/40">
      {days.map((day, idx) => {
        const dayEvents = events
          .filter((e) => isSameDay(e.start, day))
          .sort((a, b) => a.start.getTime() - b.start.getTime());
        const today = isTodayFn(day);
        const dropping = dragOver === day.toISOString();

        return (
          <div
            key={day.toISOString()}
            className={
              'group/col relative flex min-h-0 flex-col overflow-hidden bg-background/80 backdrop-blur-sm transition ' +
              (dropping ? 'visits-cal-drop' : '')
            }
            onDragOver={(e) => {
              if (dragData.current) {
                e.preventDefault();
                setDragOver(day.toISOString());
              }
            }}
            onDragLeave={() => setDragOver((cur) => (cur === day.toISOString() ? null : cur))}
            onDrop={(e) => handleDrop(e, day)}
          >
            {/* Header da coluna */}
            <div className="flex items-baseline justify-between px-4 pt-5 pb-3">
              <div className="flex flex-col gap-1">
                <span className="visits-cal-font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  {format(day, 'EEE', { locale: ptBR }).replace('.', '')}
                </span>
                <div className="relative">
                  {today && (
                    <span className="visits-cal-glow-today pointer-events-none absolute -inset-3" aria-hidden />
                  )}
                  <span
                    className={
                      'visits-cal-font-display relative inline-block text-[32px] font-light leading-none tracking-tight ' +
                      (today ? 'text-primary' : 'text-foreground')
                    }
                  >
                    {format(day, 'dd')}
                  </span>
                </div>
              </div>

              {dayEvents.length > 0 && (
                <span className="visits-cal-font-mono mt-1 rounded-full border border-border/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  {dayEvents.length}
                </span>
              )}
            </div>

            {/* "Agora" indicator */}
            {today && now.getHours() >= 6 && now.getHours() <= 23 && (
              <div className="visits-cal-now-line h-px w-full" aria-hidden />
            )}

            {/* Lista de cards */}
            <button
              type="button"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-event-card]')) return;
                const start = new Date(day);
                start.setHours(10, 0, 0, 0);
                const end = new Date(start.getTime() + 60 * 60000);
                onSelectSlot({
                  start, end, slots: [start], action: 'click', resourceId: undefined,
                } as unknown as SlotInfo);
              }}
              className="flex-1 cursor-pointer space-y-2 px-2 pb-4 overflow-y-auto text-left scrollbar-thin"
            >
              {dayEvents.length === 0 ? (
                <div className="mt-2 flex h-24 items-center justify-center rounded-xl border border-dashed border-border/40 text-muted-foreground/60 transition group-hover/col:border-primary/40 group-hover/col:text-primary/60">
                  <span className="visits-cal-font-mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em]">
                    <Plus className="h-3 w-3" /> agendar
                  </span>
                </div>
              ) : (
                dayEvents.map((evt, i) => (
                  <VisitCardMini
                    key={evt.id}
                    event={evt}
                    delay={idx * 30 + i * 40}
                    onClick={() => onSelectEvent(evt)}
                    draggable={!!onReschedule}
                    onDragStart={(e) => handleDragStart(e, evt.resource)}
                  />
                ))
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── DAY ───────────────────────── */

function DayView({
  date,
  events,
  now,
  onSelectSlot,
  onSelectEvent,
}: {
  date: Date;
  events: CalendarEvent[];
  now: Date;
  onSelectSlot: Props['onSelectSlot'];
  onSelectEvent: Props['onSelectEvent'];
}) {
  const dayEvents = events
    .filter((e) => isSameDay(e.start, date))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const today = isTodayFn(date);

  return (
    <div className="grid h-full grid-cols-[88px_1fr] gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/40">
      {/* Gutter horas */}
      <div className="flex flex-col bg-background/80 px-3 pt-6">
        {Array.from({ length: 16 }, (_, i) => 7 + i).map((h) => (
          <div key={h} className="visits-cal-font-mono flex h-16 items-start justify-end text-[10px] uppercase tracking-widest text-muted-foreground/70">
            {`${String(h).padStart(2, '0')}h`}
          </div>
        ))}
      </div>

      {/* Conteúdo */}
      <button
        type="button"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-event-card]')) return;
          const start = new Date(date);
          start.setHours(10, 0, 0, 0);
          const end = new Date(start.getTime() + 60 * 60000);
          onSelectSlot({ start, end, slots: [start], action: 'click' } as unknown as SlotInfo);
        }}
        className="relative cursor-pointer overflow-y-auto bg-background/80 px-6 pt-6 pb-8 text-left scrollbar-thin"
      >
        {/* Linhas de hora */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0">
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-px bg-border/40"
              style={{ top: `${24 + i * 64}px` }}
            />
          ))}
        </div>

        {/* Agora */}
        {today && now.getHours() >= 7 && now.getHours() <= 22 && (
          <div
            className="visits-cal-now-line pointer-events-none absolute left-0 right-0 h-px"
            style={{
              top: `${24 + (now.getHours() - 7) * 64 + (now.getMinutes() / 60) * 64}px`,
            }}
          >
            <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_2px_var(--primary)]" />
          </div>
        )}

        {/* Eventos posicionados absolutamente */}
        <div className="relative" style={{ height: `${16 * 64 + 24}px` }}>
          {dayEvents.map((evt, i) => {
            const startMin = evt.start.getHours() * 60 + evt.start.getMinutes();
            const top = 24 + ((startMin - 7 * 60) / 60) * 64;
            const heightMin = Math.max(30, differenceInMinutes(evt.end, evt.start));
            const height = (heightMin / 60) * 64 - 6;
            const status = STATUS[evt.resource.status] ?? STATUS.scheduled;
            return (
              <div
                key={evt.id}
                data-event-card
                onClick={(e) => { e.stopPropagation(); onSelectEvent(evt); }}
                className="visits-cal-card-in group/card absolute left-0 right-4 cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card/90 p-3 pl-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card hover:shadow-[0_18px_40px_-18px_var(--primary)]"
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  animationDelay: `${i * 50}ms`,
                  borderLeft: `3px solid var(${status.varName})`,
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="visits-cal-font-mono text-[12px] font-semibold tracking-tight text-foreground">
                    {format(evt.start, 'HH:mm')}
                    <span className="ml-1.5 text-[9px] font-normal uppercase tracking-[0.2em] text-muted-foreground">
                      {heightMin}min
                    </span>
                  </span>
                  <span
                    className="visits-cal-font-mono rounded-full px-2 py-0.5 text-[8px] uppercase tracking-[0.24em]"
                    style={{
                      color: `var(${status.varName})`,
                      background: `color-mix(in oklch, var(${status.varName}) 12%, transparent)`,
                    }}
                  >
                    {status.label}
                  </span>
                </div>
                {evt.resource.property && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium leading-tight text-foreground">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-primary" strokeWidth={1.5} />
                    <span className="truncate">{evt.resource.property.title}</span>
                  </div>
                )}
                {evt.resource.contact && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <UserIcon className="h-3 w-3 flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{evt.resource.contact.name}</span>
                  </div>
                )}
              </div>
            );
          })}

          {dayEvents.length === 0 && (
            <div className="absolute inset-x-0 top-24 flex flex-col items-center gap-3 text-center">
              <span className="visits-cal-font-display text-[28px] font-light italic tracking-tight text-muted-foreground">
                Um dia livre.
              </span>
              <span className="visits-cal-font-mono inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                <Plus className="h-3 w-3" /> clique para agendar
              </span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

/* ───────────────────────── MONTH ───────────────────────── */

function MonthView({
  anchor,
  events,
  onSelectDay,
  onSelectEvent,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onSelectDay: (d: Date) => void;
  onSelectEvent: Props['onSelectEvent'];
}) {
  const start = weekStart(startOfMonth(anchor));
  const cells = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [start]);

  const weekdays = useMemo(() => {
    const s = weekStart(new Date());
    return Array.from({ length: 7 }, (_, i) => format(addDays(s, i), 'EEEEEE', { locale: ptBR }).replace('.', ''));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 px-2 pb-3">
        {weekdays.map((w) => (
          <div
            key={w}
            className="visits-cal-font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/40">
        {cells.map((day) => {
          const inMonth = isSameMonth(day, anchor);
          const today = isTodayFn(day);
          const dayEvents = events
            .filter((e) => isSameDay(e.start, day))
            .slice(0, 3);
          const moreCount = events.filter((e) => isSameDay(e.start, day)).length - dayEvents.length;

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(startOfDay(day))}
              className={
                'group/cell relative flex flex-col items-start gap-1 overflow-hidden p-2 text-left transition hover:bg-primary/5 ' +
                (inMonth ? 'bg-background/80' : 'bg-background/40 text-muted-foreground/50')
              }
            >
              <span
                className={
                  'visits-cal-font-display text-[18px] font-light leading-none tracking-tight ' +
                  (today
                    ? 'inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_18px_-6px_var(--primary)]'
                    : inMonth ? 'text-foreground' : 'text-muted-foreground/60')
                }
              >
                {format(day, 'd')}
              </span>

              <div className="mt-1 flex w-full flex-col gap-1 overflow-hidden">
                {dayEvents.map((evt) => {
                  const status = STATUS[evt.resource.status] ?? STATUS.scheduled;
                  return (
                    <div
                      key={evt.id}
                      onClick={(e) => { e.stopPropagation(); onSelectEvent(evt); }}
                      data-event-card
                      className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] leading-tight hover:bg-foreground/5"
                    >
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: `var(${status.varName})` }}
                      />
                      <span className="visits-cal-font-mono text-[10px] text-muted-foreground">
                        {format(evt.start, 'HH:mm')}
                      </span>
                      <span className="truncate text-foreground">
                        {evt.resource.property?.title ?? evt.resource.contact?.name ?? 'Visita'}
                      </span>
                    </div>
                  );
                })}
                {moreCount > 0 && (
                  <span className="visits-cal-font-mono ml-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                    +{moreCount}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Visit Card (week column) ───────────────────────── */

function VisitCardMini({
  event,
  delay,
  onClick,
  draggable,
  onDragStart,
}: {
  event: CalendarEvent;
  delay: number;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const status = STATUS[event.resource.status] ?? STATUS.scheduled;
  const duration = differenceInMinutes(event.end, event.start);

  return (
    <div
      data-event-card
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      className="visits-cal-card-in group/card relative flex flex-col gap-1 rounded-xl border border-border/60 bg-card/85 px-3 py-2.5 pl-3.5 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card hover:shadow-[0_14px_32px_-16px_var(--primary)] cursor-pointer"
      style={{
        animationDelay: `${delay}ms`,
        borderLeft: `3px solid var(${status.varName})`,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="visits-cal-font-mono text-[12px] font-semibold leading-none tracking-tight text-foreground">
          {format(event.start, 'HH:mm')}
        </span>
        <span className="visits-cal-font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          {duration}m
        </span>
      </div>

      {event.resource.property && (
        <div className="mt-0.5 flex items-start gap-1.5 text-[12px] font-medium leading-snug text-foreground">
          <Building2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" strokeWidth={1.5} />
          <span className="line-clamp-2">{event.resource.property.title}</span>
        </div>
      )}

      {event.resource.contact && (
        <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <UserIcon className="h-2.5 w-2.5 flex-shrink-0" strokeWidth={1.5} />
          <span className="truncate">{event.resource.contact.name}</span>
        </div>
      )}
    </div>
  );
}
