import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './visits-calendar.css';

import type { Visit } from '@/services/visits/visitsService';

const locales = { 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: ptBR, weekStartsOn: 1 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar as never);

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Visit;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:   '#2563eb',
  confirmed:   '#16a34a',
  in_progress: '#d97706',
  completed:   '#6b7280',
  no_show:     '#dc2626',
  cancelled:   '#dc2626',
  rescheduled: '#7c3aed',
};

const MESSAGES = {
  date: 'Data',
  time: 'Hora',
  event: 'Visita',
  allDay: 'Dia inteiro',
  week: 'Semana',
  work_week: 'Semana útil',
  day: 'Dia',
  month: 'Mês',
  previous: 'Anterior',
  next: 'Próximo',
  yesterday: 'Ontem',
  tomorrow: 'Amanhã',
  today: 'Hoje',
  agenda: 'Agenda',
  noEventsInRange: 'Nenhuma visita neste período',
  showMore: (n: number) => `+${n} mais`,
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

export function VisitsCalendar({
  visits, view, date, onView, onNavigate,
  onSelectSlot, onSelectEvent, onReschedule,
}: Props) {
  const events: CalendarEvent[] = useMemo(() =>
    visits.map(v => {
      const start = new Date(v.scheduled_at);
      const end = new Date(start.getTime() + (v.duration_minutes ?? 60) * 60000);
      const title = v.property?.title
        ? `${v.property.title} • ${v.contact?.name ?? 'Sem contato'}`
        : v.contact?.name ?? 'Visita';
      return { id: v.id, title, start, end, resource: v };
    }),
  [visits]);

  const eventPropGetter = (event: CalendarEvent) => {
    const color = STATUS_COLOR[event.resource.status] ?? '#2563eb';
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        opacity: event.resource.status === 'cancelled' ? 0.55 : 1,
        textDecoration: event.resource.status === 'cancelled' ? 'line-through' as const : 'none' as const,
      },
    };
  };

  const handleEventDrop: withDragAndDropProps<CalendarEvent>['onEventDrop'] = ({ event, start }) => {
    if (onReschedule && typeof start !== 'string') {
      onReschedule(event.resource, start);
    }
  };

  return (
    <div className="visits-calendar-wrapper">
      <DnDCalendar
        localizer={localizer}
        culture="pt-BR"
        messages={MESSAGES}
        events={events}
        view={view}
        date={date}
        onView={onView}
        onNavigate={onNavigate}
        views={['month', 'week', 'day']}
        defaultView="week"
        step={30}
        timeslots={2}
        min={new Date(1970, 0, 1, 7, 0)}
        max={new Date(1970, 0, 1, 22, 0)}
        selectable
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        eventPropGetter={eventPropGetter}
        onEventDrop={handleEventDrop}
        resizable={false}
        popup
        style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}
      />
    </div>
  );
}
