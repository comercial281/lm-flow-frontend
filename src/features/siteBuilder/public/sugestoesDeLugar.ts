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

/** Grafia que mais aparece (no empate, a primeira). */
function grafiaMaisComum(contagem: Map<string, number>): string {
  return [...contagem].reduce((m, a) => (a[1] > m[1] ? a : m), ['', 0] as [string, number])[0];
}

function contar(mapa: Map<string, number>, valor: string | null | undefined) {
  const g = (valor ?? '').trim();
  if (g) mapa.set(g, (mapa.get(g) ?? 0) + 1);
}

/** Uma sugestão pronta, com o nome já normalizado e um espaço na frente (casa pelo começo de palavra). */
interface EntradaDeLugar {
  busca: string;
  sugestao: SugestaoDeLugar;
}

/**
 * Tudo que o campo pode sugerir numa aba, já normalizado e em ordem. Monta uma
 * vez por catálogo e aba (O(catálogo)); a cada tecla `buscarNoIndice` só
 * percorre as entradas, sem voltar ao catálogo.
 */
export interface IndiceDeLugar {
  condominios: EntradaDeLugar[];
  bairros: EntradaDeLugar[];
  cidades: EntradaDeLugar[];
}

interface Grupo {
  grafias: Map<string, number>;
  /** Condomínio: grafias da cidade (a mais comum vai no rótulo). Bairro: as cidades dele. */
  cidades: (string | null | undefined)[];
}

function agrupar(daAba: PortalProperty[], nome: (p: PortalProperty) => string | null | undefined): Map<string, Grupo> {
  const grupos = new Map<string, Grupo>();
  for (const p of daAba) {
    const valor = nome(p);
    const chave = normalizarTexto(valor);
    if (!chave) continue;
    const g: Grupo = grupos.get(chave) ?? { grafias: new Map(), cidades: [] };
    contar(g.grafias, valor);
    g.cidades.push(p.address?.city);
    grupos.set(chave, g);
  }
  return grupos;
}

const ordenar = (entradas: EntradaDeLugar[]) => entradas.sort((a, b) => porRotulo(a.sugestao, b.sugestao));

export function indiceDeLugar(items: PortalProperty[], tab: PortalTab): IndiceDeLugar {
  const daAba = filterProperties(items, { tab, type: '', city: '', neighborhood: '', bedrooms: '', code: '' });

  const condominios: EntradaDeLugar[] = [];
  for (const [chave, g] of agrupar(daAba, p => p.condominium_name)) {
    const nome = grafiaMaisComum(g.grafias);
    const contagem = new Map<string, number>();
    for (const c of g.cidades) contar(contagem, c);
    const cidade = grafiaMaisComum(contagem);
    condominios.push({
      busca: ' ' + chave,
      sugestao: { grupo: 'condominium', rotulo: cidade ? `${nome} (${cidade})` : nome, filtros: { condominium: nome } },
    });
  }

  const bairros: EntradaDeLugar[] = [];
  for (const [chave, g] of agrupar(daAba, p => p.address?.neighborhood)) {
    const nome = grafiaMaisComum(g.grafias);
    const cidades = opcoesSemRepetir(g.cidades);
    if (cidades.length < 2) {
      bairros.push({ busca: ' ' + chave, sugestao: { grupo: 'neighborhood', rotulo: nome, filtros: { neighborhood: nome } } });
    } else {
      for (const cidade of cidades) {
        bairros.push({
          busca: ' ' + chave,
          sugestao: { grupo: 'neighborhood', rotulo: `${nome} · ${cidade}`, filtros: { neighborhood: nome, city: cidade } },
        });
      }
    }
  }

  const cidades: EntradaDeLugar[] = opcoesSemRepetir(daAba.map(p => p.address?.city)).map(nome => ({
    busca: ' ' + normalizarTexto(nome),
    sugestao: { grupo: 'city', rotulo: nome, filtros: { city: nome } },
  }));

  return { condominios: ordenar(condominios), bairros: ordenar(bairros), cidades: ordenar(cidades) };
}

/** Sugestões de um texto no índice: começo de qualquer palavra, sem acento ("parque dos" casa; "arque" não). */
export function buscarNoIndice(indice: IndiceDeLugar, texto: string, limite = 8): SugestaoDeLugar[] {
  const alvo = normalizarTexto(texto);
  if (alvo.length < 2) return [];
  const procura = ' ' + alvo;
  const achadas: SugestaoDeLugar[] = [];
  for (const grupo of [indice.condominios, indice.bairros, indice.cidades]) {
    for (const e of grupo) {
      if (achadas.length >= limite) return achadas;
      if (e.busca.includes(procura)) achadas.push(e.sugestao);
    }
  }
  return achadas;
}

export function sugestoesDeLugar(items: PortalProperty[], tab: PortalTab, texto: string, limite = 8): SugestaoDeLugar[] {
  if (normalizarTexto(texto).length < 2) return [];
  return buscarNoIndice(indiceDeLugar(items, tab), texto, limite);
}

/**
 * A regra única de "é código?" da caixa de busca (barra da capa do Moderno, campo de lugar da
 * capa do Clássico e da página de Imóveis): o texto é o código de um imóvel do catálogo, sem
 * acento nem maiúscula? Devolve a aba em que ele aparece: a de agora, se ele está nela; senão a
 * primeira das abas do site que o mostra (um código de aluguel digitado em Comprar vai pra
 * Alugar, senão a lista viria vazia). `null` = não é código de imóvel publicado (vai como lugar).
 */
export function abaDoCodigo(items: PortalProperty[], texto: string, tab: PortalTab, abas: PortalTab[]): PortalTab | null {
  const alvo = normalizarTexto(texto);
  const achados = alvo ? items.filter(p => normalizarTexto(p.code) === alvo) : [];
  if (!achados.length) return null;
  const mostra = (t: PortalTab) => filterProperties(achados, { tab: t, type: '', city: '', neighborhood: '', bedrooms: '', code: '' }).length > 0;
  return [tab, ...abas].find(mostra) ?? tab;
}
