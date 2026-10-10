// O contrato do DONO DO NÚMERO (fase 2b.1), copiado do plano — backend
// `Numbers::Ownership`, `Numbers::Card` e os endpoints de Perfil/Equipe.

// L8: `NumberConnection` já existe no serviço da aba Números do painel raiz
// (a conferência da fase 2a). Reexportar em vez de duplicar o tipo — uma
// cópia só, senão os dois divergem em silêncio no dia em que um ganhar um
// estado novo.
import type { NumberConnection } from '@/services/superAdmin/numberOwnershipService';

export type { NumberConnection };

/** Um número de WhatsApp de que a pessoa é DONA (o gravado). */
export interface OwnedNumber {
  inbox_id: string;
  name: string;
  phone: string | null;
  /** Estado GRAVADO; a tela não pergunta ao WhatsApp. */
  connection: NumberConnection;
  /** Só desempate: o número que o sistema escolhe quando precisa de um. */
  principal: boolean;
  /** Nunca chegou a conectar (QR não lido) — a tela pede "Conectar" em vez de "Desconectado". */
  never_connected?: boolean;
}

export interface NumberOwnerRef {
  id: string;
  name: string;
}

export interface NumberCardOwner extends NumberOwnerRef {
  active: boolean;
}

/** GET /inboxes/:id/number_card — "o número tem cara". */
export interface NumberCardData {
  inbox_id: string;
  name: string;
  phone: string | null;
  connection: NumberConnection;
  /** A regra do dono vale neste cliente? */
  number_owner_rule: boolean;
  /** O GRAVADO (pode estar desativado, pode ser conta da Leal Mídia). */
  owner: NumberCardOwner | null;
  /** true = sem dono EFETIVO: o número vale como da imobiliária. */
  shared: boolean;
  roletas: string[];
  ai: string[];
}

/** GET /profile/numbers. `number_owner_rule` nulo = o servidor não disse. */
export interface MyNumbers {
  number_owner_rule: boolean | null;
  numbers: OwnedNumber[];
}
