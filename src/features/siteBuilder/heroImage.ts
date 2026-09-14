import type { SiteHeroImage, SiteHeroImageChoice, SiteHeroImageMode } from '@/services/siteBuilder/siteBuilderService';

/**
 * Foto do banner da home — o que a tela do Site Builder precisa saber, fora do
 * JSX, para ser testável: como a escolha gravada vira formulário, o que dizer
 * quando ela deixou de valer, e como a prévia é montada.
 *
 * A REGRA de qual imagem sai no site mora no servidor (Sites::HeroImage). Aqui
 * só se traduz.
 */

export const HERO_IMAGE_MODE_LABELS: Record<SiteHeroImageMode, string> = {
  auto: 'Automático',
  property: 'Foto de um imóvel',
  upload: 'Enviar uma foto',
};

export const EMPTY_HERO_IMAGE: SiteHeroImageChoice = { mode: 'auto' };

/** A escolha gravada (como o servidor a serve) vira o campo do formulário. */
export function heroImageChoiceFrom(resolved?: SiteHeroImage | null): SiteHeroImageChoice {
  if (!resolved) return { ...EMPTY_HERO_IMAGE };
  switch (resolved.mode) {
    case 'property':
      // Sem imóvel gravado não há o que apontar; o servidor já teria caído em auto.
      if (!resolved.property_id) return { ...EMPTY_HERO_IMAGE };
      return { mode: 'property', property_id: resolved.property_id, photo_id: resolved.photo_id ?? null };
    case 'upload':
      if (!resolved.url) return { ...EMPTY_HERO_IMAGE };
      return { mode: 'upload', url: resolved.url };
    default:
      return { ...EMPTY_HERO_IMAGE };
  }
}

/**
 * Quando a escolha de imóvel deixou de valer, o site já caiu no automático.
 * A tela avisa com o motivo, em vez de mostrar uma prévia vazia.
 */
export function heroImageWarning(resolved?: SiteHeroImage | null): string | null {
  if (!resolved || resolved.mode !== 'property') return null;
  const nome = resolved.property?.title ? `«${resolved.property.title}»` : 'escolhido';
  switch (resolved.reason) {
    case 'imovel_removido':
      return 'O imóvel escolhido foi apagado. O site está usando o banner automático até você escolher outra foto.';
    case 'imovel_despublicado':
      return `O imóvel ${nome} não está mais publicado no site. O banner voltou ao automático até você escolher outra foto ou publicá-lo de novo.`;
    case 'imovel_sem_foto':
      return `O imóvel ${nome} não tem foto publicada. O banner voltou ao automático até ele ganhar uma foto.`;
    case 'erro':
      return 'Não consegui carregar a foto do imóvel escolhido. O site está usando o banner automático.';
    default:
      return null;
  }
}
