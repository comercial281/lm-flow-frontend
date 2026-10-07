import type { LucideIcon } from 'lucide-react';
import { Puzzle, Share2 } from 'lucide-react';
import whatsappLogo from '@/assets/channels/whatsapp.png';
// O facebook.png dos canais é o ícone do Messenger; aqui vai o "f" do Facebook.
import facebookLogo from '@/assets/integrations/facebook.svg';
import {
  ENTRADA_INTEGRACOES, SISTEMAS_INTEGRACOES, donoDoEndereco, enderecoCasa, getCustomerMenuSections,
  type CartaoDeIntegracao, type MenuItem, type MenuSection, type SubMenuItem,
} from '@/components/layout/config/menuItems';

// ── INTEGRAÇÕES EM CARTÕES (07/10/2026) ──────────────────────────────────────
//
// As telas de Integrações continuam cadastradas no item do menu, cada uma com o
// `cartao` em que mora. Tudo aqui lê a lista JÁ filtrada pelo cargo (MenuContext):
// cartão, bloco do Facebook e "← Integrações" nunca conferem permissão sozinhos.

export interface Cartao {
  id: CartaoDeIntegracao;
  nome: string;
  frase: string;
  /** Logo da marca. Sem logo, o ícone. */
  logo?: string;
  icone?: LucideIcon;
}

export const CARTOES: readonly Cartao[] = [
  { id: 'whatsapp', nome: 'WhatsApp', frase: 'Os números que atendem seus leads', logo: whatsappLogo },
  { id: 'facebook', nome: 'Facebook', frase: 'Página dos anúncios e Pixel', logo: facebookLogo },
  { id: 'portais', nome: 'Portais', frase: 'ZAP, Imóvel Web e outros portais', icone: Share2 },
  // Peças, não o robô: o robô é a IA Vendedora no menu.
  { id: 'sistemas', nome: 'Sistemas', frase: 'Mande os leads pro sistema que você já usa', icone: Puzzle },
];

export const NENHUMA_INTEGRACAO = 'Nenhuma integração disponível pro seu acesso.';

const cartao = (id: CartaoDeIntegracao): Cartao => CARTOES.find(c => c.id === id)!;

/** O item Integrações na lista filtrada. null = a pessoa não vê nenhuma tela dele. */
export function itemDeIntegracoes(secoes: MenuSection[]): MenuItem | null {
  for (const secao of secoes) {
    for (const item of secao.itens) if (item.entrada === ENTRADA_INTEGRACOES) return item;
  }
  return null;
}

export interface CartaoVisivel {
  cartao: Cartao;
  href: string;
  telas: SubMenuItem[];
}

/**
 * Cartões que sobraram: aparece o que tem pelo menos uma tela visível. Sistemas
 * leva à página própria; os outros, à primeira tela que sobrou (quem só vê o
 * Pixel cai no endereço do Pixel, não na trava da Página).
 */
export function cartoesVisiveis(item: MenuItem | null): CartaoVisivel[] {
  const telas = item?.abas ?? [];
  return CARTOES.flatMap(c => {
    const minhas = telas.filter(t => t.cartao === c.id);
    if (minhas.length === 0) return [];
    return [{ cartao: c, href: c.id === 'sistemas' ? SISTEMAS_INTEGRACOES : minhas[0].href, telas: minhas }];
  });
}

export interface Barra {
  voltarPara: string;
  voltarRotulo: string;
  nome: string;
  logo?: string;
  icone?: LucideIcon;
}

/**
 * Barra do topo das telas de Integrações. Só existe pra quem vê a entrada (o
 * corretor em "Meus números" não ganha um "voltar" pra página vazia). O cartão da
 * tela vem do cadastro COMPLETO do menu: endereço digitado de tela que o filtro
 * escondeu (Página do Facebook no painel raiz) continua com a barra certa.
 */
export function barraDoEndereco(secoesFiltradas: MenuSection[], pathname: string): Barra | null {
  if (!itemDeIntegracoes(secoesFiltradas)) return null;
  if (enderecoCasa(pathname, ENTRADA_INTEGRACOES, true)) return null;

  const paraEntrada = { voltarPara: ENTRADA_INTEGRACOES, voltarRotulo: 'Integrações' };
  if (enderecoCasa(pathname, SISTEMAS_INTEGRACOES)) {
    const { nome, icone } = cartao('sistemas');
    return { ...paraEntrada, nome, icone };
  }

  const tela = donoDoEndereco(getCustomerMenuSections(), pathname)?.aba;
  if (!tela?.cartao) return null;
  if (tela.cartao === 'sistemas') {
    return { voltarPara: SISTEMAS_INTEGRACOES, voltarRotulo: 'Sistemas', nome: tela.name, icone: tela.icon };
  }
  const { nome, logo, icone } = cartao(tela.cartao);
  return { ...paraEntrada, nome, logo, icone };
}
