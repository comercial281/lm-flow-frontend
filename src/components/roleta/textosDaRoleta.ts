// Textos e endereços da roleta usados FORA da página dela (card, automações).
import { roletaLabel } from '@/services/roletaConfig/roletaConfigService';

/** A página da roleta (lista das roletas). */
export const PAGINA_DA_ROLETA = '/automations/roleta-config';

type RoletaComNome = Parameters<typeof roletaLabel>[0];

/**
 * O aviso de quem mandou o lead pra roleta. "Oferecido", nunca "Atribuído": o
 * lead só é do corretor quando ele aceita.
 */
export function textoDaOferta(corretor: string | null | undefined, roleta: RoletaComNome): string {
  const nome = `Roleta ${roletaLabel(roleta)}`;
  return corretor?.trim() ? `Oferecido a ${corretor.trim()} pela ${nome}` : `Mandado pra ${nome}`;
}
