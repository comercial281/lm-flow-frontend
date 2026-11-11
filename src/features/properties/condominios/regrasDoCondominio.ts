// Regras puras dos condomínios: aba, formulário, o que a unidade plugada herda e quando pode plugar.
// A tela só desenha; nada de regra no JSX.
import type { Condominium, CondominiumFormData, CondominiumKind } from '@/services/condominiums/condominiumsService';
import type { Property, PropertyFormData } from '@/services/properties/propertiesService';
import type { ListingKind } from '../listingKind';
import { nomeNoFormulario } from '../cadastro/travasDoSite';

export const ABA_CONDOMINIOS = 'condominios';

export const estaNaAbaDeCondominios = (sp: URLSearchParams): boolean => sp.get('aba') === ABA_CONDOMINIOS;

export const CONDOMINIO_VAZIO: CondominiumFormData = {
  name: '',
  kind: 'vertical',
  builder_name: null,
  developer_name: null,
  administrator_name: null,
  year_built: null,
  internal_note: null,
  address_cep: null,
  address_street: null,
  address_number: null,
  address_complement: null,
  address_neighborhood: null,
  address_city: null,
  address_state: null,
  latitude: null,
  longitude: null,
  location_source: null,
  condo_features: [],
  contacts: [],
};

export function formularioDoCondominio(c: Condominium): CondominiumFormData {
  return {
    name: c.name,
    kind: c.kind,
    builder_name: c.builder_name,
    developer_name: c.developer_name,
    administrator_name: c.administrator_name,
    year_built: c.year_built,
    internal_note: c.internal_note,
    address_cep: c.address_cep,
    address_street: c.address_street,
    address_number: c.address_number,
    address_complement: c.address_complement,
    address_neighborhood: c.address_neighborhood,
    address_city: c.address_city,
    address_state: c.address_state,
    latitude: c.latitude,
    longitude: c.longitude,
    location_source: c.location_source,
    condo_features: [...(c.condo_features ?? [])],
    contacts: (c.contacts ?? []).map((x) => ({ ...x })),
  };
}

// Mesmas mensagens do servidor.
export function errosDoCondominio(f: CondominiumFormData): string[] {
  const erros: string[] = [];
  if (!f.name?.trim()) erros.push('Dê um nome ao condomínio.');
  if (!f.address_street?.trim() || !f.address_city?.trim() || !f.address_state?.trim()) {
    erros.push('Preencha rua, cidade e UF do condomínio.');
  }
  return erros;
}

const ENDERECO_NA_TELA = ['address_zip', 'address_street', 'address_number', 'address_neighborhood', 'address_city', 'address_state'] as const;

/** Campos da unidade que o condomínio controla (nomes da tela). */
export function camposHerdados(c: { kind: CondominiumKind; locked_fields?: string[] }): string[] {
  if (c.locked_fields?.length) return c.locked_fields.map(nomeNoFormulario);
  return [...ENDERECO_NA_TELA, ...(c.kind === 'horizontal' ? [] : ['latitude', 'longitude']), 'condo_features'];
}

/** Valores do condomínio para pôr no formulário da unidade ao plugar. */
export function valoresHerdados(c: Condominium, kind: CondominiumKind, form?: Partial<PropertyFormData>): Partial<PropertyFormData> {
  const v: Partial<PropertyFormData> = {
    address_zip: c.address_cep ?? undefined,
    address_street: c.address_street ?? undefined,
    address_number: c.address_number ?? undefined,
    address_neighborhood: c.address_neighborhood ?? undefined,
    address_city: c.address_city ?? undefined,
    address_state: c.address_state ?? undefined,
    condo_features: [...(c.condo_features ?? [])],
  };
  if (kind !== 'horizontal') {
    v.latitude = c.latitude;
    v.longitude = c.longitude;
  } else if (form && form.latitude == null && form.longitude == null && c.latitude != null && c.longitude != null) {
    // A unidade sem alfinete aproveita o do condomínio; com alfinete, mantém o dela.
    v.latitude = c.latitude;
    v.longitude = c.longitude;
  }
  return v;
}

const vazio = (x: unknown) => x == null || (typeof x === 'string' && !x.trim()) || (Array.isArray(x) && x.length === 0);
const igual = (a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return (a ?? null) === (b ?? null);
};

/** Algum campo herdado preenchido na unidade difere do condomínio? (decide se pede confirmação) */
export function difereDoCondominio(form: PropertyFormData, c: Condominium): boolean {
  const herdados = valoresHerdados(c, c.kind) as Record<string, unknown>;
  const atual = form as unknown as Record<string, unknown>;
  return Object.keys(herdados).some((k) => !vazio(atual[k]) && !igual(atual[k], herdados[k]));
}

export const AVISO_UNIDADE_COM_SITE = 'Este imóvel vem do site da imobiliária: endereço e comodidades vêm de lá.';

export function podePlugar(imovel: Property | null, kind: ListingKind): { pode: boolean; motivo?: string } {
  if (kind === 'development') return { pode: false };
  if (imovel?.feed?.locked_fields?.length) return { pode: false, motivo: AVISO_UNIDADE_COM_SITE };
  return { pode: true };
}

export function textoDasUnidades(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? 'Mudanças aqui valem para a unidade plugada.' : `Mudanças aqui valem para as ${n} unidades plugadas.`;
}

export function textoDasFotosDoCondominio(n: number): string {
  if (n <= 0) return '';
  return n === 1
    ? 'Mais 1 foto do condomínio entra depois destas no site e nos portais.'
    : `Mais ${n} fotos do condomínio entram depois destas no site e nos portais.`;
}
