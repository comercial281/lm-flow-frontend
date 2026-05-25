import { EVENT_NAMES, type EvoFlowEventName } from './event-names';
import { EVENT_CATALOG, EVENT_CATEGORIES } from './catalog';
import type { EventCatalogEntry, EventCategory, Locale } from './types';

export type { EventCatalogEntry, EventCategory, EventSchema, FieldSpec, FieldType, Locale } from './types';
export { EVENT_NAMES, EVENT_CATEGORIES };
export type { EvoFlowEventName };

export function getEventCatalog(): EventCatalogEntry[] {
  return EVENT_NAMES.map((name) => EVENT_CATALOG[name]);
}

export function getEvent(eventName: string): EventCatalogEntry | undefined {
  return EVENT_CATALOG[eventName];
}

export function isCanonicalEvent(eventName: string): eventName is EvoFlowEventName {
  return (EVENT_NAMES as readonly string[]).includes(eventName);
}

export function getEventsByCategory(category: EventCategory): EventCatalogEntry[] {
  return getEventCatalog().filter((entry) => entry.category === category);
}

export function getEventLabel(eventName: string, locale: Locale): string {
  const entry = getEvent(eventName);
  if (!entry) return eventName;
  // Treat any pt-* locale as PT-BR for now; expand as more locales gain catalog labels.
  return locale === 'en' ? entry.labelEn : entry.labelPt;
}

export function isCustomEvent(eventName: string): boolean {
  return eventName === 'custom';
}
