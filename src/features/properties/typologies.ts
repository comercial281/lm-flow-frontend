/* ────────────────────────────────────────────────────────────────────────────
   Tipologias (plantas) do imóvel — fonte da verdade única do contrato.

   Um empreendimento raramente tem UMA planta: o mesmo prédio vende "2 dorms
   58m²", "3 dorms 74m²" e a cobertura, cada uma com preço próprio. O backend
   guarda isso no jsonb `properties.typologies` (array de objetos com as chaves
   abaixo — qualquer outra é descartada lá) e os campos soltos do imóvel
   (bedrooms, useful_area_m2, sale_price…) seguem sendo o RESUMO que alimenta
   filtro, busca e card, por convenção o da tipologia de entrada.

   Usado pelo cadastro (Properties.tsx) e pela página pública (ImovelPublicPage).
──────────────────────────────────────────────────────────────────────────── */

export interface PropertyTypology {
  /** Rótulo da planta como está no book ("Tipo A", "Final 3"). Opcional. */
  name?: string | null;
  bedrooms?: number | null;
  suites?: number | null;
  bathrooms?: number | null;
  parking_spaces?: number | null;
  useful_area_m2?: number | null;
  total_area_m2?: number | null;
  sale_price?: number | null;
  rent_price?: number | null;
  /** Quantas unidades dessa planta ainda estão disponíveis. */
  units_available?: number | null;
  notes?: string | null;
}

/** Faixas do empreendimento devolvidas pelo backend (min/max por campo). */
export interface TypologyRange { min: number; max: number }
export interface TypologySummary {
  count: number;
  bedrooms?: TypologyRange | null;
  useful_area_m2?: TypologyRange | null;
  sale_price?: TypologyRange | null;
  rent_price?: TypologyRange | null;
}

export const EMPTY_TYPOLOGY: PropertyTypology = {
  name: '',
  bedrooms: null,
  suites: null,
  bathrooms: null,
  parking_spaces: null,
  useful_area_m2: null,
  total_area_m2: null,
  sale_price: null,
  rent_price: null,
  units_available: null,
  notes: '',
};

/** Nome de exibição: o que o corretor digitou ou, na falta, "2 dormitórios". */
export function typologyName(t: PropertyTypology, index = 0): string {
  const name = (t.name ?? '').trim();
  if (name) return name;
  const beds = t.bedrooms ?? 0;
  if (beds > 0) return `${beds} dormitório${beds > 1 ? 's' : ''}`;
  return `Tipologia ${index + 1}`;
}

const area = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m²`;

/** Specs curtas pra linha da tabela: "2 dorm. · 1 suíte · 1 vaga · 58,5 m²". */
export function typologySpecs(t: PropertyTypology): string[] {
  const parts: string[] = [];
  if (t.bedrooms) parts.push(`${t.bedrooms} dorm.`);
  if (t.suites) parts.push(`${t.suites} suíte${t.suites > 1 ? 's' : ''}`);
  if (t.bathrooms) parts.push(`${t.bathrooms} banh.`);
  if (t.parking_spaces) parts.push(`${t.parking_spaces} vaga${t.parking_spaces > 1 ? 's' : ''}`);
  if (t.useful_area_m2) parts.push(`${area(t.useful_area_m2)} úteis`);
  if (t.total_area_m2) parts.push(`${area(t.total_area_m2)} totais`);
  if (t.units_available) parts.push(`${t.units_available} disponível${t.units_available > 1 ? 'is' : ''}`);
  return parts;
}

/** Preço da tipologia já formatado (venda tem prioridade; aluguel leva "/mês"). */
export function typologyPrice(t: PropertyTypology): string | null {
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  if (t.sale_price) return brl(t.sale_price);
  if (t.rent_price) return `${brl(t.rent_price)}/mês`;
  return null;
}

/** Linha "2 a 4 dorms · 58 a 120 m² · a partir de R$ 450.000" pra vitrine. */
export function typologyHeadline(list?: PropertyTypology[] | null): string | null {
  if (!list?.length) return null;
  const range = (values: number[]) => (values.length ? { min: Math.min(...values), max: Math.max(...values) } : null);
  const nums = (key: keyof PropertyTypology) =>
    list.map(t => Number(t[key] ?? 0)).filter(v => v > 0);

  const beds = range(nums('bedrooms'));
  const areas = range(nums('useful_area_m2'));
  const prices = nums('sale_price');

  const parts: string[] = [];
  if (beds) parts.push(beds.min === beds.max ? `${beds.min} dorms` : `${beds.min} a ${beds.max} dorms`);
  if (areas) parts.push(areas.min === areas.max ? area(areas.min) : `${areas.min.toLocaleString('pt-BR')} a ${area(areas.max)}`);
  if (prices.length) {
    parts.push(`a partir de ${Math.min(...prices).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

/** Descarta as linhas em branco antes de mandar pro backend (ele faria o mesmo). */
export function cleanTypologies(list?: PropertyTypology[] | null): PropertyTypology[] {
  if (!list?.length) return [];
  return list.filter(t =>
    Object.entries(t).some(([, v]) => (typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined)),
  );
}
