// Modelos do site (D2): três pontos de partida pro VISUAL do site. Um modelo
// grava só fonte, `appearance` (menos logo clara, frase do rodapé e filtro da
// capa), `listing.card_layout`, `home.callouts.layout` e o liga/desliga das
// seções novas. Cores, textos, vitrines, busca e menu nunca são tocados.
import type { Aparencia } from './public/aparenciaConfig';
import { APARENCIA_FABRICA } from './public/aparenciaConfig';
import type { HomeConfig } from './public/homeConfig';
import { PASSOS_MCMV } from './public/homeConfig';
import type { ListaConfig } from './public/listaConfig';

export type ModeloDoSiteId = 'classico' | 'editorial' | 'popular';
export interface ModeloDoSite { id: ModeloDoSiteId; nome: string; frase: string }

export const MODELOS_DO_SITE: ModeloDoSite[] = [
  { id: 'classico', nome: 'Clássico', frase: 'Capa com foto, topo transparente e cartões em grade. O visual de sempre.' },
  { id: 'editorial', nome: 'Editorial', frase: 'Fundo escuro, título em fonte com serifa, capa dividida e cartões grandes.' },
  { id: 'popular', nome: 'Popular', frase: 'Topo na cor da marca, capa dividida e o passo a passo de como comprar.' },
];

export interface EstadoDoVisual {
  font_family: string | null;
  appearance: Aparencia;
  home: HomeConfig;
  listing: ListaConfig;
}

type ChavesDaAparencia = 'heading_font' | 'background' | 'header_style' | 'top_bar' | 'hero_layout' | 'hero_height'
  | 'menu_style' | 'card_style' | 'footer_layout';

interface Receita {
  font_family: string;
  appearance: Pick<Aparencia, ChavesDaAparencia>;
  card_layout: ListaConfig['card_layout'];
  callouts: HomeConfig['callouts']['layout'];
  passos: boolean;
  atendimento: boolean;
}

const { heading_font, background, header_style, top_bar, hero_layout, hero_height, menu_style, card_style, footer_layout } = APARENCIA_FABRICA;
const BASE = { heading_font, background, header_style, top_bar, hero_layout, hero_height, menu_style, card_style, footer_layout };

const RECEITAS: Record<ModeloDoSiteId, Receita> = {
  classico: { font_family: 'Inter', appearance: { ...BASE }, card_layout: 'grid', callouts: 'band', passos: false, atendimento: false },
  editorial: {
    font_family: 'DM Sans',
    appearance: {
      heading_font: 'Playfair Display', background: 'dark', header_style: 'transparent', top_bar: 'hidden',
      hero_layout: 'split', hero_height: 'full', menu_style: 'caps', card_style: 'large', footer_layout: 'compact',
    },
    card_layout: 'rows', callouts: 'cards', passos: false, atendimento: true,
  },
  popular: {
    font_family: 'Poppins',
    appearance: { ...BASE, header_style: 'brand', hero_layout: 'split', hero_height: 'half' },
    card_layout: 'grid', callouts: 'cards', passos: true, atendimento: false,
  },
};

/** Textos do Atendimento quando o cliente ainda não escreveu o título (só nos campos vazios). */
export const ATENDIMENTO_DE_FABRICA = {
  eyebrow: 'Atendimento',
  title: 'Do primeiro contato à escritura, com uma pessoa só.',
  text: 'Conte o que você procura. A gente seleciona, acompanha as visitas e cuida da papelada até a entrega das chaves.',
  button_label: 'Agendar uma conversa',
  button_link: '#contato',
};

/** O patch que o botão grava (só o visual). */
export function aplicarModelo(id: ModeloDoSiteId, atual: EstadoDoVisual): EstadoDoVisual & { font_family: string } {
  const r = RECEITAS[id];
  const { home } = atual;
  // Textos de fábrica só quando o título está vazio, e campo a campo: só o que
  // está vazio (null ou só espaços) ganha o texto. O que o cliente já escreveu
  // fica. Com título escrito, o Atendimento só é ligado, sem acrescentar nada.
  const vazio = (v: string | null | undefined) => !v?.trim();
  const semTitulo = vazio(home.about.title);
  const completarAtendimento = () => {
    const about = { ...home.about, enabled: true };
    (Object.keys(ATENDIMENTO_DE_FABRICA) as (keyof typeof ATENDIMENTO_DE_FABRICA)[]).forEach(k => {
      if (vazio(about[k])) about[k] = ATENDIMENTO_DE_FABRICA[k];
    });
    return about;
  };
  return {
    font_family: r.font_family,
    appearance: { ...atual.appearance, ...r.appearance },
    listing: { ...atual.listing, card_layout: r.card_layout },
    home: {
      ...home,
      callouts: { ...home.callouts, layout: r.callouts },
      steps: {
        ...home.steps,
        enabled: r.passos,
        items: r.passos && home.steps.items.length === 0 ? PASSOS_MCMV.map(p => ({ ...p })) : home.steps.items,
      },
      about: !r.atendimento
        ? { ...home.about, enabled: false }
        : semTitulo ? completarAtendimento() : { ...home.about, enabled: true },
    },
  };
}

/** Qual modelo o site já tem: só se TODAS as chaves da tabela batem. */
export function modeloAtual(atual: EstadoDoVisual): ModeloDoSiteId | null {
  const achado = (Object.keys(RECEITAS) as ModeloDoSiteId[]).find(id => {
    const r = RECEITAS[id];
    return atual.font_family === r.font_family
      && (Object.keys(r.appearance) as ChavesDaAparencia[]).every(k => atual.appearance[k] === r.appearance[k])
      && atual.listing.card_layout === r.card_layout
      && atual.home.callouts.layout === r.callouts
      && atual.home.steps.enabled === r.passos
      && atual.home.about.enabled === r.atendimento;
  });
  return achado ?? null;
}
