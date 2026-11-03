// Materiais (Tarefa 74): regras puras da página. A tela só desenha.
// O vínculo do material com o imóvel é o `property_codes` do documento (lista de códigos).
import type { SalesAgent, SalesAgentDocument } from '@/services/salesAgents/salesAgentsService';
import type { Property } from '@/services/properties/propertiesService';
import { tipoDoImovel } from '@/features/properties/listingKind';

/** O imóvel como a página precisa dele: o cadastro pode não ter vindo (código solto num material). */
export type ImovelDaPagina = Pick<Property, 'code' | 'title'> & Partial<Pick<Property,
  'id' | 'listing_kind' | 'latitude' | 'longitude' | 'address_neighborhood' | 'address_city' | 'has_book' | 'book_file_name'
  | 'virtual_tour_url' | 'photos_count'>>;

/** O "quando mandar" que não se edita: fotos e vídeo, o pino e o tour saem sempre nestes momentos. */
export const QUANDO_PADRAO = {
  fotos: 'quando pedirem fotos, vídeo ou quiserem ver o imóvel',
  pino: 'quando perguntarem onde fica ou como chegar',
  tour: 'quando quiserem conhecer sem visitar',
} as const;

const codigosDe = (d: SalesAgentDocument) => d.property_codes ?? [];

/** Enviável sem imóvel ligado: vale pra qualquer conversa. */
export function materiaisDaCasa(docs: SalesAgentDocument[]): SalesAgentDocument[] {
  return docs.filter((d) => d.sendable && codigosDe(d).length === 0);
}

/** Por código de imóvel. Material ligado a vários imóveis aparece em todos; só entram os imóveis pedidos. */
export function materiaisPorImovel(docs: SalesAgentDocument[], imoveis: { code: string }[]): Record<string, SalesAgentDocument[]> {
  const por: Record<string, SalesAgentDocument[]> = {};
  imoveis.forEach((i) => { por[i.code] = docs.filter((d) => d.sendable && codigosDe(d).includes(i.code)); });
  return por;
}

/**
 * Espelha a regra do servidor (`Property#public_coordinates?`, restrição "endereço exato" e a coordenada
 * com bairro ou cidade) só pra explicar na tela. Quem decide é o servidor. A chave `location_pin_enabled`
 * não entra aqui: ela liga e desliga, e "Fotos e vídeo" desligado não tira o pino.
 */
export function porQueOPinoNaoSai(imovel: ImovelDaPagina, agent: Pick<SalesAgent, 'ai_limits'>): string | null {
  if (tipoDoImovel(imovel) !== 'development') return 'Só empreendimento manda o pino. Revenda, leilão e locação ela responde por texto, com o bairro e a região.';
  if (agent.ai_limits?.address) return 'A restrição "Endereço exato" está ligada na Condução. Com ela, nem o empreendimento manda o pino.';
  if (imovel.latitude == null || imovel.longitude == null) return 'O cadastro ainda não tem o ponto no mapa. Marque o imóvel no mapa pra ela mandar o pino.';
  if (!imovel.address_neighborhood?.trim() && !imovel.address_city?.trim()) return 'Falta o bairro ou a cidade no cadastro. Sem eles ela não manda o pino.';
  return null;
}

export const pinoPode = (imovel: ImovelDaPagina, agent: Pick<SalesAgent, 'ai_limits'>): boolean => porQueOPinoNaoSai(imovel, agent) === null;

/** Junta listas de imóveis sem repetir o código (vale o primeiro). */
export function juntarImoveis(...listas: ImovelDaPagina[][]): ImovelDaPagina[] {
  const vistos = new Set<string>();
  return listas.flat().filter((i) => (vistos.has(i.code) ? false : (vistos.add(i.code), true)));
}
