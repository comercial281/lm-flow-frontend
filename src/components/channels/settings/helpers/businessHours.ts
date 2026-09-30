import { parse, getHours, getMinutes, differenceInMinutes } from 'date-fns';
import i18n from '@/i18n/config';

// Types
export interface TimeSlot {
  day: number;
  from: string;
  to: string;
  valid: boolean;
  openAllDay?: boolean;
}

export interface BusinessHourSlot {
  day_of_week: number;
  closed_all_day: boolean;
  open_hour: number;
  open_minutes: number;
  close_hour: number;
  close_minutes: number;
  open_all_day: boolean;
}

export interface TimeZone {
  label: string;
  value: string;
}

// Default time slots for all days (disabled by default)
export const defaultTimeSlot: TimeSlot[] = [
  { day: 0, to: '', from: '', valid: false }, // Sunday
  { day: 1, to: '', from: '', valid: false }, // Monday
  { day: 2, to: '', from: '', valid: false }, // Tuesday
  { day: 3, to: '', from: '', valid: false }, // Wednesday
  { day: 4, to: '', from: '', valid: false }, // Thursday
  { day: 5, to: '', from: '', valid: false }, // Friday
  { day: 6, to: '', from: '', valid: false }, // Saturday
];

// Day names mapping
export const getDayNames = (): Record<number, string> => ({
  0: i18n.t('channels:settings.businessHours.days.sunday'),
  1: i18n.t('channels:settings.businessHours.days.monday'),
  2: i18n.t('channels:settings.businessHours.days.tuesday'),
  3: i18n.t('channels:settings.businessHours.days.wednesday'),
  4: i18n.t('channels:settings.businessHours.days.thursday'),
  5: i18n.t('channels:settings.businessHours.days.friday'),
  6: i18n.t('channels:settings.businessHours.days.saturday'),
});

// Horário na tela é SEMPRE 24h ("09:00", "17:30"). Até a Fase 3 (30/09/2026)
// estes textos eram "09:00 AM"/"05:00 PM" — formato americano na cara do
// gestor. O servidor nunca viu esse texto: ele guarda hora e minuto em número
// (open_hour/open_minutes), então a troca é só da tela.
export const FORMATO_HORA = 'HH:mm';
export const MEIA_NOITE = '00:00';
export const FIM_DO_DIA = '23:59';

// Generate time slots with specified step (in minutes)
export const generateTimeSlots = (step = 30): string[] => {
  const slots: string[] = [];
  for (let minutos = 0; minutos < 24 * 60; minutos += step) {
    slots.push(getTime(Math.floor(minutos / 60), minutos % 60));
  }

  return slots;
};

// Convert hour and minute to time string
export const getTime = (hour: number, minute: number): string =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

// Parse business hours from API format to UI format
export const timeSlotParse = (timeSlots: BusinessHourSlot[]): TimeSlot[] => {
  return timeSlots.map(slot => {
    const {
      day_of_week: day,
      open_hour: openHour,
      open_minutes: openMinutes,
      close_hour: closeHour,
      close_minutes: closeMinutes,
      closed_all_day: closedAllDay,
      open_all_day: openAllDay,
    } = slot;

    const from = closedAllDay ? '' : getTime(openHour, openMinutes);
    const to = closedAllDay ? '' : getTime(closeHour, closeMinutes);

    return {
      day,
      to,
      from,
      valid: !closedAllDay,
      openAllDay,
    };
  });
};

// Transform UI format to API format
export const timeSlotTransform = (timeSlots: TimeSlot[]): BusinessHourSlot[] => {
  return timeSlots.map(slot => {
    const closed = slot.openAllDay ? false : !(slot.to && slot.from);
    const openAllDay = slot.openAllDay || false;
    let openHour = 0;
    let openMinutes = 0;
    let closeHour = 0;
    let closeMinutes = 0;

    if (!closed && slot.from && slot.to) {
      openHour = getHours(parse(slot.from, FORMATO_HORA, new Date()));
      openMinutes = getMinutes(parse(slot.from, FORMATO_HORA, new Date()));
      closeHour = getHours(parse(slot.to, FORMATO_HORA, new Date()));
      closeMinutes = getMinutes(parse(slot.to, FORMATO_HORA, new Date()));
    }

    return {
      day_of_week: slot.day,
      closed_all_day: closed,
      open_hour: openHour,
      open_minutes: openMinutes,
      close_hour: closeHour,
      close_minutes: closeMinutes,
      open_all_day: openAllDay,
    };
  });
};

// Validate time slot (from must be before to)
export const validateTimeSlot = (from: string, to: string): boolean => {
  if (!from || !to) return false;

  try {
    const fromDate = parse(from, FORMATO_HORA, new Date());
    const toDate = parse(to, FORMATO_HORA, new Date());

    // Special case for midnight (next day)
    if (to === MEIA_NOITE) return true;

    return differenceInMinutes(toDate, fromDate) > 0;
  } catch {
    return false;
  }
};

// Calculate total hours for a time slot
export const calculateTotalHours = (timeSlot: TimeSlot): number => {
  if (timeSlot.openAllDay) return 24;

  if (!timeSlot.from || !timeSlot.to || !timeSlot.valid) return 0;

  try {
    const fromDate = parse(timeSlot.from, FORMATO_HORA, new Date());
    const toDate = parse(timeSlot.to, FORMATO_HORA, new Date());

    // Handle midnight as next day
    if (timeSlot.to === MEIA_NOITE) {
      const nextDayMidnight = new Date(toDate);
      nextDayMidnight.setDate(nextDayMidnight.getDate() + 1);
      return differenceInMinutes(nextDayMidnight, fromDate) / 60;
    }

    return Math.max(0, differenceInMinutes(toDate, fromDate) / 60);
  } catch {
    return 0;
  }
};

// Timezone data (simplified for Brazil-focused app)
export const getTimeZoneOptions = (): TimeZone[] => [
  { label: i18n.t('channels:settings.businessHours.timezones.brasilia'), value: 'America/Sao_Paulo' },
  { label: i18n.t('channels:settings.businessHours.timezones.acre'), value: 'America/Rio_Branco' },
  { label: i18n.t('channels:settings.businessHours.timezones.manaus'), value: 'America/Manaus' },
  { label: i18n.t('channels:settings.businessHours.timezones.fernandoDeNoronha'), value: 'America/Noronha' },
  { label: i18n.t('channels:settings.businessHours.timezones.utc'), value: 'UTC' },
  { label: i18n.t('channels:settings.businessHours.timezones.easternTime'), value: 'America/New_York' },
  { label: i18n.t('channels:settings.businessHours.timezones.centralTime'), value: 'America/Chicago' },
  { label: i18n.t('channels:settings.businessHours.timezones.mountainTime'), value: 'America/Denver' },
  { label: i18n.t('channels:settings.businessHours.timezones.pacificTime'), value: 'America/Los_Angeles' },
  { label: i18n.t('channels:settings.businessHours.timezones.london'), value: 'Europe/London' },
  { label: i18n.t('channels:settings.businessHours.timezones.paris'), value: 'Europe/Paris' },
  { label: i18n.t('channels:settings.businessHours.timezones.tokyo'), value: 'Asia/Tokyo' },
];

export const getDefaultTimezone = (): TimeZone => ({
  label: i18n.t('channels:settings.businessHours.timezones.brasilia'),
  value: 'America/Sao_Paulo',
});
