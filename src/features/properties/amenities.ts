/* ────────────────────────────────────────────────────────────────────────────
   Catálogo de características/comodidades do imóvel — fonte da verdade única.
   O backend guarda apenas os SLUGS (arrays jsonb `features` / `condo_features`);
   os rótulos vivem aqui e são reusados pelo formulário de cadastro
   (Properties.tsx) e pela página pública (ImovelPublicPage.tsx).

   Para adicionar/editar uma característica, mexa só neste arquivo. Nunca renomeie
   um `slug` já em uso (os imóveis guardam o slug) — troque só o `label` se quiser
   mudar o texto exibido.
──────────────────────────────────────────────────────────────────────────── */

export interface Amenity {
  slug: string;
  label: string;
}

/** Características do próprio imóvel. */
export const PROPERTY_FEATURES: Amenity[] = [
  { slug: 'piscina', label: 'Piscina' },
  { slug: 'churrasqueira', label: 'Churrasqueira' },
  { slug: 'varanda_gourmet', label: 'Varanda gourmet' },
  { slug: 'aceita_pet', label: 'Aceita pet' },
  { slug: 'mobiliado', label: 'Mobiliado' },
  { slug: 'ar_condicionado', label: 'Ar-condicionado' },
  { slug: 'aquecimento_solar', label: 'Aquecimento solar' },
  { slug: 'closet', label: 'Closet' },
  { slug: 'escritorio', label: 'Escritório' },
  { slug: 'area_servico', label: 'Área de serviço' },
  { slug: 'despensa', label: 'Despensa' },
  { slug: 'armarios_planejados', label: 'Armários planejados' },
  { slug: 'lareira', label: 'Lareira' },
  { slug: 'jardim', label: 'Jardim' },
  { slug: 'quintal', label: 'Quintal' },
  { slug: 'agua', label: 'Água' },
];

/** Comodidades do condomínio. */
export const CONDO_FEATURES: Amenity[] = [
  { slug: 'portaria_24h', label: 'Portaria 24h' },
  { slug: 'seguranca', label: 'Segurança' },
  { slug: 'cerca_eletrica', label: 'Cerca elétrica' },
  { slug: 'circuito_interno_tv', label: 'Circuito interno de TV' },
  { slug: 'salao_de_festas', label: 'Salão de festas' },
  { slug: 'espaco_gourmet', label: 'Espaço gourmet' },
  { slug: 'academia', label: 'Academia' },
  { slug: 'piscina_condominio', label: 'Piscina' },
  { slug: 'quadra', label: 'Quadra poliesportiva' },
  { slug: 'campo_de_futebol', label: 'Campo de futebol' },
  { slug: 'playground', label: 'Playground' },
  { slug: 'clube', label: 'Clube' },
  { slug: 'bosque', label: 'Bosque' },
  { slug: 'elevador', label: 'Elevador' },
  { slug: 'gerador', label: 'Gerador' },
  { slug: 'bicicletario', label: 'Bicicletário' },
];

const LABEL_BY_SLUG: Record<string, string> = Object.fromEntries(
  [...PROPERTY_FEATURES, ...CONDO_FEATURES].map(a => [a.slug, a.label]),
);

/** Converte uma lista de slugs em rótulos, descartando slugs desconhecidos. */
export function labelsFor(slugs?: string[] | null): string[] {
  if (!slugs?.length) return [];
  return slugs.map(s => LABEL_BY_SLUG[s]).filter(Boolean) as string[];
}
