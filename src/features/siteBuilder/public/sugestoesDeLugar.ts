// Sugestões do campo "Condomínio, bairro ou cidade": saem do catálogo que o
// navegador já carregou, só com o que tem imóvel na aba.
import { filterProperties, normalizarTexto, opcoesSemRepetir, type PortalFilters, type PortalProperty, type PortalTab } from './filtros';

export type GrupoDeLugar = 'condominium' | 'neighborhood' | 'city';

export interface SugestaoDeLugar {
  grupo: GrupoDeLugar;
  rotulo: string;
  filtros: Partial<Pick<PortalFilters, 'condominium' | 'neighborhood' | 'city'>>;
}

export const ROTULO_DO_GRUPO: Record<GrupoDeLugar, string> = {
  condominium: 'Condomínio',
  neighborhood: 'Bairro',
  city: 'Cidade',
};

const porRotulo = (a: SugestaoDeLugar, b: SugestaoDeLugar) => a.rotulo.localeCompare(b.rotulo, 'pt-BR');

/** Começo de qualquer palavra do nome ("parque dos" casa; "arque" não). */
const casa = (nome: string, texto: string) => (' ' + normalizarTexto(nome)).includes(' ' + texto);

/** Grafia que mais aparece entre os imóveis (no empate, a primeira). */
function grafiaMaisComum(valores: (string | null | undefined)[]): string {
  const contagem = new Map<string, number>();
  for (const v of valores) {
    const g = (v ?? '').trim();
    if (g) contagem.set(g, (contagem.get(g) ?? 0) + 1);
  }
  return [...contagem].reduce((m, a) => (a[1] > m[1] ? a : m), ['', 0] as [string, number])[0];
}

export function sugestoesDeLugar(items: PortalProperty[], tab: PortalTab, texto: string, limite = 8): SugestaoDeLugar[] {
  const alvo = normalizarTexto(texto);
  if (alvo.length < 2) return [];
  const daAba = filterProperties(items, { tab, type: '', city: '', neighborhood: '', bedrooms: '', code: '' });

  const condominios: SugestaoDeLugar[] = opcoesSemRepetir(daAba.map(p => p.condominium_name))
    .filter(nome => casa(nome, alvo))
    .map(nome => {
      const chave = normalizarTexto(nome);
      const cidade = grafiaMaisComum(
        daAba.filter(p => normalizarTexto(p.condominium_name) === chave).map(p => p.address?.city),
      );
      return {
        grupo: 'condominium' as const,
        rotulo: cidade ? `${nome} (${cidade})` : nome,
        filtros: { condominium: nome },
      };
    })
    .sort(porRotulo);

  const bairros: SugestaoDeLugar[] = opcoesSemRepetir(daAba.map(p => p.address?.neighborhood))
    .filter(nome => casa(nome, alvo))
    .flatMap<SugestaoDeLugar>(nome => {
      const chave = normalizarTexto(nome);
      const doBairro = daAba.filter(p => normalizarTexto(p.address?.neighborhood) === chave);
      const cidades = opcoesSemRepetir(doBairro.map(p => p.address?.city));
      if (cidades.length < 2) return [{ grupo: 'neighborhood', rotulo: nome, filtros: { neighborhood: nome } }];
      return cidades.map(cidade => ({
        grupo: 'neighborhood' as const,
        rotulo: `${nome} · ${cidade}`,
        filtros: { neighborhood: nome, city: cidade },
      }));
    })
    .sort(porRotulo);

  const cidades: SugestaoDeLugar[] = opcoesSemRepetir(daAba.map(p => p.address?.city))
    .filter(nome => casa(nome, alvo))
    .map(nome => ({ grupo: 'city' as const, rotulo: nome, filtros: { city: nome } }))
    .sort(porRotulo);

  return [...condominios, ...bairros, ...cidades].slice(0, limite);
}
