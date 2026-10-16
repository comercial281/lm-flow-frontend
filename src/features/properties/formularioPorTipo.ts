// O formulário de hoje com o tipo já marcado (Fase 4, entrega 2). A entrega 3
// é a página de cadastro (cadastro/), que usa estas duas funções.
import type { PropertyFormData } from '@/services/properties/propertiesService';
import type { ListingKind } from './listingKind';
import { menorPrecoDasTipologias } from './typologies';

export function formularioNovo(kind: ListingKind): Partial<PropertyFormData> {
  if (kind === 'development') return { listing_kind: 'development', transaction_type: 'sale', stage: 'launch', delivery_forecast: '' };
  if (kind === 'auction') return { listing_kind: 'auction', transaction_type: 'sale', stage: 'ready', delivery_forecast: '' };
  return { listing_kind: 'resale', stage: 'ready', delivery_forecast: '' };
}

export function payloadDoFormulario(form: PropertyFormData): PropertyFormData {
  const emp = form.listing_kind === 'development';
  // Empreendimento e Leilão são sempre venda.
  const soVenda = emp || form.listing_kind === 'auction';
  const semPrevisao = emp && form.stage === 'ready';
  const previsao = semPrevisao ? null : form.delivery_forecast || null;
  // Empreendimento com preço nas plantas: o Valor de venda é o "a partir de" (o servidor faz o mesmo).
  const aPartirDe = emp ? menorPrecoDasTipologias(form.typologies) : null;
  return { ...form, transaction_type: soVenda ? 'sale' : form.transaction_type, delivery_forecast: previsao,
    sale_price: aPartirDe ?? form.sale_price };
}
