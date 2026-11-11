// Regras puras dos condomínios: aba, formulário, o que a unidade plugada herda e quando pode plugar.
// A tela só desenha; nada de regra no JSX.
import type { Condominium, CondominiumContact, CondominiumFormData, CondominiumKind } from '@/services/condominiums/condominiumsService';
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

// ── Cadastro do condomínio na tela ──────────────────────────────────────────
// A Localização é a mesma do imóvel: o CEP se chama `address_zip` na tela e
// `address_cep` no servidor, e os campos de texto ficam '' (nunca nulo) no campo.

type TextosDoEndereco = 'address_street' | 'address_number' | 'address_complement' | 'address_neighborhood' | 'address_city' | 'address_state';

export type CondominioNaTela = Omit<CondominiumFormData, 'address_cep' | 'location_source' | TextosDoEndereco> & {
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  location_source: 'auto' | 'manual' | '' | null;
};

const ORIGENS = ['auto', 'manual'] as const;

export function condominioNaTela(f: CondominiumFormData): CondominioNaTela {
  const { address_cep, location_source, ...resto } = f;
  return {
    ...resto,
    address_zip: address_cep ?? '',
    address_street: f.address_street ?? '',
    address_number: f.address_number ?? '',
    address_complement: f.address_complement ?? '',
    address_neighborhood: f.address_neighborhood ?? '',
    address_city: f.address_city ?? '',
    address_state: f.address_state ?? '',
    location_source: (ORIGENS as readonly string[]).includes(location_source ?? '') ? (location_source as 'auto' | 'manual') : null,
  };
}

const textoOuNulo = (v: string | null | undefined) => v?.trim() || null;
const contatoVazio = (c: CondominiumContact) => !c.name.trim() && !c.phone.trim() && !c.email.trim();

/** O que vai para o servidor: CEP com o nome dele, texto vazio vira nulo, contato em branco sai. */
export function payloadDoCondominio(t: CondominioNaTela): CondominiumFormData {
  const { address_zip, ...resto } = t;
  return {
    ...resto,
    name: t.name.trim(),
    address_cep: textoOuNulo(address_zip),
    address_street: textoOuNulo(t.address_street),
    address_number: textoOuNulo(t.address_number),
    address_complement: textoOuNulo(t.address_complement),
    address_neighborhood: textoOuNulo(t.address_neighborhood),
    address_city: textoOuNulo(t.address_city),
    address_state: textoOuNulo(t.address_state),
    location_source: t.location_source || null,
    builder_name: textoOuNulo(t.builder_name),
    developer_name: textoOuNulo(t.developer_name),
    administrator_name: textoOuNulo(t.administrator_name),
    internal_note: textoOuNulo(t.internal_note),
    contacts: (t.contacts ?? [])
      .filter(c => !contatoVazio(c))
      .map(c => ({ name: c.name.trim(), role: c.role, phone: c.phone.trim(), email: c.email.trim() })),
  };
}

/** Seção do cadastro onde o erro de `errosDoCondominio` mora. */
export const secaoDoErro = (mensagem: string): 'basico' | 'localizacao' =>
  mensagem === 'Dê um nome ao condomínio.' ? 'basico' : 'localizacao';

export const ROTULO_DO_CARGO: Record<CondominiumContact['role'], string> = {
  zelador: 'Zelador', porteiro: 'Porteiro', sindico: 'Síndico', administradora: 'Administradora', outro: 'Outro',
};

export const CONTATO_VAZIO: CondominiumContact = { name: '', role: 'zelador', phone: '', email: '' };

/**
 * Depois de criar: com `?voltar=` (só caminho interno de Imóveis, ex.: o cadastro da
 * unidade que pediu o condomínio novo) volta para lá com `condominio=<id>`; senão
 * abre o cadastro do condomínio criado.
 */
export function destinoDepoisDeCriar(voltar: string | null, id: string): string {
  const volta = caminhoDeVolta(voltar);
  if (!volta) return `/properties/condominios/${id}`;
  return `${volta}${volta.includes('?') ? '&' : '?'}condominio=${encodeURIComponent(id)}`;
}

/**
 * "+ Cadastrar condomínio" no cadastro da unidade: abre o cadastro do condomínio com
 * a volta para esta unidade. Um `condominio=` que ainda esteja no endereço sai, senão
 * a volta ficaria com dois (o velho e o novo).
 */
export function linkParaCadastrarCondominio(pathname: string, search: string): string {
  const sp = new URLSearchParams(search);
  sp.delete('condominio');
  const resto = sp.toString();
  const voltar = resto ? `${pathname}?${resto}` : pathname;
  return `/properties/condominios/novo?voltar=${encodeURIComponent(voltar)}`;
}

/** O `?voltar=` só vale como caminho interno de Imóveis; qualquer outro vira nulo. */
export function caminhoDeVolta(voltar: string | null): string | null {
  const interno = !!voltar && voltar.startsWith('/properties/') && !voltar.includes('//') && !voltar.includes('\\');
  return interno ? voltar : null;
}

/** Textos da confirmação de excluir (Global Constraints). */
export function pedidoDeExclusao(nome: string, unidades: number): { titulo: string; descricao: string } {
  const titulo = `Excluir o condomínio ${nome}?`;
  if (unidades <= 0) return { titulo, descricao: 'Não dá para desfazer.' };
  if (unidades === 1) {
    return { titulo, descricao: 'A unidade plugada fica com o endereço e as comodidades de hoje e passa a ser editada nela.' };
  }
  return { titulo, descricao: `As ${unidades} unidades plugadas ficam com o endereço e as comodidades de hoje e passam a ser editadas nelas.` };
}
