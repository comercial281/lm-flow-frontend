export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'uuid' | 'object';

export interface FieldSpec {
  type: FieldType;
  description?: string;
}

export interface EventSchema {
  required: Record<string, FieldSpec>;
  optional: Record<string, FieldSpec>;
  allowExtraProperties: boolean;
}

export type EventCategory = 'contact' | 'conversation' | 'message' | 'campaign' | 'custom';

export type Locale = 'pt-BR' | 'en' | 'es' | 'fr' | 'it' | 'pt';

export interface EventCatalogEntry {
  eventName: string;
  category: EventCategory;
  labelPt: string;
  labelEn: string;
  description: string;
  schema: EventSchema;
}
