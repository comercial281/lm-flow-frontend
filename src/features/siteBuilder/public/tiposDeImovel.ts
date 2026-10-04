// Nomes em português dos tipos de imóvel do servidor (enum Property.property_type).
// O site mostrava a chave crua em vários (condo_house, lot, sobrado…).
export const ROTULO_TIPO: Record<string, string> = {
  apartment: 'Apartamento', house: 'Casa', condo_house: 'Casa em condomínio', lot: 'Terreno', commercial_room: 'Sala comercial',
  warehouse: 'Galpão', farm: 'Fazenda', studio: 'Studio', kitnet: 'Kitnet', loft: 'Loft', penthouse: 'Cobertura', duplex: 'Duplex',
  triplex: 'Triplex', cobertura: 'Cobertura', sobrado: 'Sobrado', sala_comercial: 'Sala comercial', galpao: 'Galpão', predio: 'Prédio',
  terreno: 'Terreno', chacara: 'Chácara', sitio: 'Sítio', other: 'Outro',
};
export const PLURAL_TIPO: Record<string, string> = {
  apartment: 'Apartamentos', house: 'Casas', condo_house: 'Casas em condomínio', lot: 'Terrenos', commercial_room: 'Salas comerciais',
  warehouse: 'Galpões', farm: 'Fazendas', studio: 'Studios', kitnet: 'Kitnets', loft: 'Lofts', penthouse: 'Coberturas', duplex: 'Duplex',
  triplex: 'Triplex', cobertura: 'Coberturas', sobrado: 'Sobrados', sala_comercial: 'Salas comerciais', galpao: 'Galpões', predio: 'Prédios',
  terreno: 'Terrenos', chacara: 'Chácaras', sitio: 'Sítios', other: 'Outros imóveis',
};
export const rotuloTipo = (t: string) => ROTULO_TIPO[t] ?? 'Imóvel';
export const pluralTipo = (t: string) => PLURAL_TIPO[t] ?? 'Imóveis';

/** Opções de um seletor de tipo: um item por nome (cobertura/penthouse viram um só), mantendo a primeira chave. */
export function opcoesDeTipo(tipos: string[]): [string, string][] {
  const vistos = new Set<string>();
  return tipos.map(t => [t, rotuloTipo(t)] as [string, string]).filter(([, l]) => (vistos.has(l) ? false : (vistos.add(l), true)));
}

/** Opção do seletor que representa `valor` (um sinônimo na URL marca a opção do mesmo nome). */
export function opcaoDoTipo(tipos: string[], valor: string): string {
  if (!valor) return '';
  return opcoesDeTipo(tipos).find(([, l]) => l === rotuloTipo(valor))?.[0] ?? valor;
}
