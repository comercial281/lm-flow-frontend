/**
 * Origem POR ESCRITO do lead cadastrado na mão — "de onde veio esse lead" na
 * língua do corretor, não a classificação técnica de canal.
 *
 * Vive em contact.additional_attributes.lead_origin.manual_origin (backend:
 * LeadOrigin::Recorder::MANUAL_ORIGIN_KEY) e é enviado pelo campo
 * `lead_origin_note` do POST/PATCH /contacts.
 *
 * As sugestões abaixo são atalhos, NÃO uma lista fechada: o campo é texto livre,
 * porque cada imobiliária chama as coisas do seu jeito.
 *
 * Onde é usado:
 * - AddItemModal ("Criar novo lead" no kanban)
 * - ContactForm (Novo contato / edição na página de Contatos)
 * - EditItemModal, aba Origem (mostra e permite corrigir depois)
 */
export const MANUAL_ORIGIN_KEY = 'manual_origin';

export const MANUAL_ORIGIN_MAX_LENGTH = 120;

export const MANUAL_ORIGIN_LABEL = 'Origem informada';

export const MANUAL_ORIGIN_PLACEHOLDER = 'Ex.: indicação do João, cliente de carteira, plantão...';

export const MANUAL_ORIGIN_SUGGESTIONS: string[] = [
  'Indicação',
  'Cliente de carteira',
  'Prospecção ativa',
  'Plantão / stand',
  'Placa no imóvel',
  'Portal de imóveis',
  'Evento / feirão',
  'Parceria com imobiliária',
];

/** Lê a origem escrita de um contato, venha ela do card ou do próprio contato. */
export function readManualOrigin(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const value = (source as Record<string, unknown>)[MANUAL_ORIGIN_KEY];
  return typeof value === 'string' ? value : '';
}
