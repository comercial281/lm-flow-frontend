// A regra do DONO DO NÚMERO vale neste cliente? (fase 2b.1)
//
// Duas fontes, nesta ordem:
//   1. o ECO do servidor — Canais, Equipe, Perfil e Roleta devolvem
//      `number_owner_rule` junto com o dado. É ele que cobre os 5 minutos de
//      cache das funcionalidades no navegador logo depois do Ligar da aba
//      Números;
//   2. a chave do cliente, quando a resposta não trouxe o eco (servidor antigo,
//      ou tela que ainda não carregou).
//
// ⚠️ `useClientToggle`, nunca `useFeature`: a chave nasce DESLIGADA
// (ClientInstance::DEFAULT_OFF_FEATURES no backend) e o endpoint público
// resolve chave ausente como ligada. Trocar um pelo outro estreia a regra para
// todo cliente.
//
// ⚠️ A chave vai LITERAL na chamada: os scanners do catálogo
// (scripts/sync-feature-catalog.mjs e audit-feature-catalog.mjs) a acham por
// regex. E ela só aparece AQUI (há spec).

import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import type { NumberCardData } from './types';

/**
 * O que `ChannelSettings` manda como `numberOwnerRule` de `CollaboratorsForm` e
 * `NumberCard`. Só canal de WhatsApp promete a regra do dono — um canal de
 * e-mail ou API mostrando "quem escreve aqui vai direto pro dono" (L11) não
 * faz sentido nenhum, e o `number_card` só existe para WhatsApp. Fora do JSX
 * (Global Constraint), com spec.
 */
export function ownerRuleForChannel(
  isWhatsApp: boolean,
  card: Pick<NumberCardData, 'number_owner_rule'> | null | undefined,
): boolean | null {
  return isWhatsApp ? (card?.number_owner_rule ?? null) : false;
}

export function resolveOwnerRule(serverEcho: boolean | null | undefined, toggle: boolean): boolean {
  return typeof serverEcho === 'boolean' ? serverEcho : toggle;
}

/** O primeiro eco booleano de uma lista de respostas (ex.: as roletas). */
export function ownerRuleFromList(
  list: ReadonlyArray<{ number_owner_rule?: boolean | null }> | null | undefined,
): boolean | null {
  const achado = (list ?? []).find(item => typeof item.number_owner_rule === 'boolean');
  return achado ? (achado.number_owner_rule as boolean) : null;
}

export function useNumberOwnerRule(serverEcho?: boolean | null): boolean {
  const toggle = useClientToggle('numero_dono_unico');
  return resolveOwnerRule(serverEcho, toggle);
}
