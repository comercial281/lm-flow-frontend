// Formulário ↔ imóvel e validação do cadastro (Fase 4, Imóveis, entrega 3).
// O mapeamento é o que o `openEdit` de Properties.tsx montava, mais os campos novos.
import type { Property, PropertyFormData } from '@/services/properties/propertiesService';
import { leadDestinationWarning } from '../leadDestination';
import { paraCampoMes, tipoDoImovel } from '../listingKind';
import { payloadDoFormulario } from '../formularioPorTipo';
import type { SecaoId } from './secoesDoCadastro';

export interface ErroDoCadastro { secao: SecaoId; mensagem: string }

// O formulário em branco (era o EMPTY_FORM de Properties.tsx). O cadastro novo
// soma o `formularioNovo(kind)` por cima, para o tipo vir marcado.
export const FORMULARIO_VAZIO: PropertyFormData = {
  title: '',
  description: '',
  transaction_type: 'sale',
  category_type: 'residential',
  property_type: 'apartment',
  status: 'active',
  stage: 'ready',
  listing_kind: 'resale',
  delivery_forecast: '',
  sale_price: null,
  rent_price: null,
  condo_fee: null,
  iptu: null,
  bedrooms: null,
  bathrooms: null,
  suites: null,
  parking_spaces: null,
  useful_area_m2: null,
  total_area_m2: null,
  address_street: '',
  address_number: '',
  address_complement: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  latitude: null,
  longitude: null,
  exclusive: false,
  featured: false,
  published_on_site: false,
  ai_enabled: true,
  on_sign: false,
  responsible_id: null,
  lead_goes_to_responsible: false,
  captor_id: null,
  label_id: null,
  features: [],
  condo_features: [],
  typologies: [],
};

export function formularioDoImovel(p: Property): PropertyFormData {
  return {
    title: p.title,
    description: p.description ?? '',
    // Empreendimento é sempre venda: o campo some da tela, então o valor salvo não pode mandar nos preços.
    transaction_type: tipoDoImovel(p) === 'development' ? 'sale' : p.transaction_type,
    category_type: p.category_type,
    property_type: p.property_type,
    status: p.status,
    stage: p.stage,
    listing_kind: tipoDoImovel(p),
    delivery_forecast: paraCampoMes(p.delivery_forecast),
    sale_price: p.sale_price,
    rent_price: p.rent_price,
    condo_fee: p.condo_fee ?? null,
    iptu: p.iptu ?? null,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    suites: p.suites,
    parking_spaces: p.parking_spaces,
    useful_area_m2: p.useful_area_m2,
    total_area_m2: p.total_area_m2 ?? null,
    address_street: p.address_street ?? '',
    address_number: p.address_number ?? '',
    address_complement: p.address_complement ?? '',
    address_neighborhood: p.address_neighborhood ?? '',
    address_city: p.address_city ?? '',
    address_state: p.address_state ?? '',
    address_zip: p.address_zip ?? '',
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    exclusive: p.exclusive ?? false,
    featured: p.featured ?? false,
    published_on_site: p.published_on_site ?? false,
    ai_enabled: p.ai_enabled ?? true,
    on_sign: p.on_sign ?? false,
    responsible_id: p.responsible?.id ?? p.responsible_id ?? null,
    // Campo ausente = servidor antigo (a coluna nasce no boot): a chave abre
    // desligada, que é o comportamento do imóvel sem exceção nenhuma.
    lead_goes_to_responsible: p.lead_goes_to_responsible === true,
    captor_id: p.captor?.id ?? p.captor_id ?? null,
    owner_contact_id: p.owner_contact_id ?? null,
    label_id: p.label_id ?? null,
    features: p.features ?? [],
    condo_features: p.condo_features ?? [],
    typologies: p.typologies ?? [],
    // Campos da entrega 3: imóvel antigo vem sem eles.
    owner_id: p.owner_id ?? null,
    accepts_financing: p.accepts_financing ?? null,
    accepts_fgts: p.accepts_fgts ?? null,
    mcmv: p.mcmv ?? null,
    building_standard: p.building_standard ?? null,
    total_units: p.total_units ?? null,
    towers: p.towers ?? null,
    floors: p.floors ?? null,
    construction_year: p.construction_year ?? null,
    iptu_period: p.iptu_period ?? null,
    video_url: p.video_url ?? '',
    virtual_tour_url: p.virtual_tour_url ?? '',
    builder: p.builder ?? {},
    internal_info: p.internal_info ?? {},
    commission: p.commission ?? {},
  };
}

// Mesmas regras que o handleSave tinha. Quem chama decide quais valem: o
// "Salvar rascunho" checa só o título, o "Criar"/"Salvar" chama tudo.
export function errosDoCadastro(form: PropertyFormData): ErroDoCadastro[] {
  const erros: ErroDoCadastro[] = [];
  if (!form.title?.trim()) erros.push({ secao: 'basico', mensagem: 'Título é obrigatório' });
  const p = payloadDoFormulario(form);
  // Valor de venda é obrigatório p/ Venda/Venda e Locação (regra do backend).
  // Rascunho (criado ou editado) pode ficar sem preço: o servidor aceita.
  if (form.status !== 'draft' && (p.transaction_type === 'sale' || p.transaction_type === 'sale_rent') && !form.sale_price) {
    erros.push({ secao: form.listing_kind === 'development' ? 'tipologias' : 'valores',
      mensagem: 'Informe o Valor de venda (obrigatório para imóveis à venda).' });
  }
  // Chave de destino próprio ligada sem responsável: o servidor recusa o cadastro inteiro.
  const destino = leadDestinationWarning(form);
  if (destino) erros.push({ secao: 'equipe', mensagem: destino });
  return erros;
}

export function payloadDoCadastro(form: PropertyFormData, { rascunho }: { rascunho: boolean }): PropertyFormData {
  const base = payloadDoFormulario(form);
  return rascunho ? { ...base, status: 'draft' } : base;
}
