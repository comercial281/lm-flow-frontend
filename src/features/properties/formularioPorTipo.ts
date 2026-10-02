// O formulário de hoje com o tipo já marcado (Fase 4, entrega 2). O redesenho
// dos dois cadastros é a entrega 3 (empreendimento) e a 7 (revenda).
import type { PropertyFormData } from '@/services/properties/propertiesService';
import type { ListingKind } from './listingKind';

export function formularioNovo(kind: ListingKind): Partial<PropertyFormData> {
  return kind === 'development'
    ? { listing_kind: 'development', transaction_type: 'sale', stage: 'launch', delivery_forecast: '' }
    : { listing_kind: 'resale', stage: 'ready', delivery_forecast: '' };
}

export function payloadDoFormulario(form: PropertyFormData): PropertyFormData {
  const emp = form.listing_kind === 'development';
  const previsao = emp && form.stage !== 'ready' && form.delivery_forecast ? form.delivery_forecast : null;
  return { ...form, transaction_type: emp ? 'sale' : form.transaction_type, delivery_forecast: previsao };
}
