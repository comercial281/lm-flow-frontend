// src/pages/Customer/Properties/lista/pinoDoMapa.ts
// O card que abre em cima do alfinete no Mapa de Imóveis (pedido do Tony,
// 16/10/2026): foto, preço e dados com o mouse parado no alfinete, e o clique
// leva ao imóvel. As regras moram aqui; a peça só pinta.
import type { PropertyMapMarker } from '@/services/properties/propertiesService';

/** Quanto o mouse precisa ficar parado no alfinete (o do funil é 0,8 s; o alfinete é pequeno). */
export const ESPERA_DO_CARD_NO_MAPA_MS = 300;

/** A página pública do imóvel, a mesma do "Ver página no site" da lista. */
export const paginaNoSite = (origem: string, slug: string, code: string) =>
  `${origem}/imovel/${slug}/${code}`;

export type DestinoDoPino =
  | { tipo: 'site'; endereco: string; texto: string }
  | { tipo: 'cadastro'; endereco: string; texto: string };

/**
 * Pra onde o clique leva. No site → a página do site (o mapa só traz
 * Disponível/Reservado, então basta a marcação). Fora do site → o cadastro, só
 * pra quem pode editar. Sem nenhum dos dois, o card mostra e não abre nada.
 * Servidor antigo (sem `published_on_site`) conta como fora do site: abrir uma
 * página que não existe é pior que abrir o cadastro.
 */
export function destinoDoPino(
  m: Pick<PropertyMapMarker, 'id' | 'code' | 'published_on_site'>,
  { podeEditar, slug, origem }: { podeEditar: boolean; slug: string | null; origem: string },
): DestinoDoPino | null {
  if (m.published_on_site === true && slug) {
    return { tipo: 'site', endereco: paginaNoSite(origem, slug, m.code), texto: 'Ver página no site' };
  }
  if (podeEditar) return { tipo: 'cadastro', endereco: `/properties/${m.id}/editar`, texto: 'Abrir cadastro' };
  return null;
}

export const TEXTO_SEM_DESTINO = 'Este imóvel não está no site';

/** Bairro e cidade numa linha só ("Mooca, São Paulo"); sem nenhum dos dois, nada. */
export const localDoPino = (m: Pick<PropertyMapMarker, 'neighborhood' | 'city'>) =>
  [m.neighborhood, m.city].filter(Boolean).join(', ') || null;

/** Abre em cima do alfinete, centrado; sem espaço em cima, embaixo. Nunca sai da tela. */
export function posicaoDoCardNoMapa(
  pino: { left: number; right: number; top: number; bottom: number },
  tela: { largura: number; altura: number },
  card: { largura: number; altura: number },
): { left: number; top: number; lado: 'cima' | 'baixo' } {
  const VAO = 8;
  const MARGEM = 8;
  const centro = (pino.left + pino.right) / 2;
  let left = centro - card.largura / 2;
  left = Math.max(MARGEM, Math.min(left, tela.largura - card.largura - MARGEM));
  const emCima = pino.top - VAO - card.altura;
  const lado = emCima >= MARGEM ? 'cima' : 'baixo';
  let top = lado === 'cima' ? emCima : pino.bottom + VAO;
  top = Math.max(MARGEM, Math.min(top, tela.altura - card.altura - MARGEM));
  return { left, top, lado };
}
