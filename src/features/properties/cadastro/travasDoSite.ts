// Imóvel que vem do site do cliente: o site sempre ganha (decisão do Tony, 13/10/2026).
// A seção que tem campo vindo do site fica travada; o servidor também ignora esses campos.
import type { SecaoId } from './secoesDoCadastro';

export const AVISO_DO_SITE = 'Este imóvel vem do site da imobiliária. O que vem de lá fica travado: mude no site e o LM Flow atualiza em até 1 hora.';

// Campos que cada seção edita de fato (conferido em pages/Customer/Properties/cadastro/secoes).
const CAMPOS_DA_SECAO: Partial<Record<SecaoId, string[]>> = {
  basico: ['title', 'transaction_type', 'property_type', 'category_type', 'status'],
  localizacao: ['address_cep', 'address_street', 'address_number', 'address_neighborhood', 'address_city', 'address_state', 'latitude', 'longitude'],
  valores: ['sale_price', 'rent_price', 'condo_fee', 'iptu', 'iptu_period', 'appraisal_value', 'occupancy'],
  composicao: ['bedrooms', 'bathrooms', 'suites', 'parking_spaces', 'useful_area_m2', 'total_area_m2'],
  // Trava a seção inteira (inclui FGTS/MCMV) quando o financiamento vem do site (Leilão).
  detalhesVenda: ['accepts_financing'],
  caracteristicas: ['features', 'condo_features'],
  // O link do vídeo mora em Fotos e vídeos.
  midia: ['video_url'],
  descricao: ['description'],
};

export function secaoTravada(secao: SecaoId, locked: string[]): boolean {
  if (!locked.length) return false;
  return (CAMPOS_DA_SECAO[secao] ?? []).some(c => locked.includes(c));
}
