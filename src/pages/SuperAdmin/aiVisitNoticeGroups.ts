// Como cada grupo aparece na linha de uma imobiliária, no *Aviso de visita da IA*.
//
// O número operacional da Leal Mídia está em mais de um grupo por cliente: o
// grupo DA IMOBILIÁRIA ("APTO PREMIUM x Leal Mídia", onde o aviso deve cair) e o
// grupo de LOGS INTERNOS, que é da Leal Mídia sobre aquele cliente. Até
// 22/09/2026 a lista mostrava só o nome do grupo — e um nome como "LM FLOW LOGS"
// não diz nada sobre para onde a mensagem iria. Quem abre esta linha está
// decidindo se liga um disparo irreversível num grupo com gente de verdade
// dentro; ver QUAL grupo é qual é a única pergunta que se faz aqui.
//
// Mora fora do JSX porque a regra é testável e a seção não é — a mesma decisão
// das outras traduções deste repositório.

import type { AiVisitNoticeGroup } from '@/services/superAdmin/aiVisitNoticeService';

export interface GroupLine {
  /** O selo ao lado do nome. Vazio quando não há nada a dizer. */
  badge: string;
  /** O tom do selo: o grupo interno não pode parecer o destino natural. */
  tone: 'client' | 'internal' | 'neutral';
  /** A explicação embaixo, quando ela muda a decisão. Vazio = sem linha. */
  note: string;
}

/**
 * ⚠️ O tipo do grupo vem do SERVIDOR (`kind`), nunca do nome dele. Deduzir
 * "isto é grupo de logs" a partir do texto faria a tela chamar de interno o
 * grupo de uma imobiliária que por acaso tenha "log" no nome — e o contrário,
 * que é pior: o grupo interno passando por grupo do cliente.
 */
export function groupLine(group: AiVisitNoticeGroup): GroupLine {
  const naoVisto = group.found === false;

  if (group.kind === 'logs') {
    return {
      badge: 'Logs internos',
      tone: 'internal',
      note: 'Grupo da Leal Mídia sobre este cliente. O aviso só sai aqui se você marcar.',
    };
  }

  if (group.kind === 'cliente') {
    return {
      badge: 'Grupo do cliente',
      tone: 'client',
      note: naoVisto
        ? 'Cadastrado na ficha do cliente, mas o número operacional não o listou — confira se ele ainda está nesse grupo.'
        : '',
    };
  }

  if (group.source === 'escolhido') {
    return {
      badge: 'Escolhido à mão',
      tone: 'neutral',
      note: 'Marcado antes e não reconhecido na lista de agora. Continua valendo como destino.',
    };
  }

  return {
    badge: 'Reconhecido pelo nome',
    tone: 'neutral',
    note: '',
  };
}

/**
 * Sem nenhum marcado, o servidor escolhe sozinho — e ele NUNCA escolhe o grupo
 * de logs internos. A frase precisa dizer isso, senão "marquei nada e não sai
 * nada" num cliente que tem grupo interno vira chamado de suporte.
 */
export const HINT_SEM_MARCA =
  'Sem marcar nada, o aviso sai no grupo da imobiliária quando houver só um — o de logs '
  + 'internos nunca é escolhido sozinho. Marque quando ela tiver mais de um, ou quando o '
  + 'grupo certo não for o reconhecido.';
