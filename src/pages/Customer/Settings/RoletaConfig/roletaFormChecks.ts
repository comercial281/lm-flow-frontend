// POR QUE A ROLETA NÃO SALVA — as conferências, fora do componente.
//
// Em 07/08/2026 criar uma roleta falhou duas vezes seguidas sem que a tela
// dissesse nada. Duas falhas somadas:
//
//   1. As conferências da tela eram uma escada de `if` com um toast cada: a
//      primeira interrompia o resto, e o aviso sumia sozinho em segundos.
//   2. A recusa do servidor era jogada fora — o `catch` lia a mensagem do axios
//      ("Request failed with status code 422") em vez do motivo que vinha no
//      corpo da resposta.
//
// Aqui mora a parte (1), como função pura: recebe o formulário, devolve TODOS os
// problemas de uma vez, em português e em linguagem de tela. Fora do componente
// porque é o miolo da resposta "o que falta preencher?" e precisa ser testável
// sem montar o formulário inteiro.
//
// Estas conferências ESPELHAM as do backend de propósito — as mesmas recusas,
// ditas antes da viagem. O backend continua sendo a autoridade: o que passar
// daqui e ainda assim for recusado lá aparece no mesmo painel, com o texto dele.

import type { DistributionMode, RoletaHoursWindow } from '@/services/roletaConfig/roletaConfigService';

export interface RoletaFormCheckInput {
  /** O WhatsApp de entrada da roleta. */
  inboxId: string;
  /** O cliente pode ter roleta com mais de um número? */
  multiEnabled: boolean;
  /** As roletas que já existem — é como sabemos que um número já está ocupado. */
  configs: {
    id: string;
    inbox_id: string;
    display_name?: string | null;
    inbox_name?: string | null;
    /** TODOS os números da roleta, não só o de entrada. */
    instances?: { inbox_id: string; answers_direct_inbound?: boolean }[];
  }[];
  /** Nulo ao criar; o id da roleta ao editar (ela não conflita consigo mesma). */
  editingId: string | null;
  instances: { inbox_id: string; is_active: boolean; answers_direct_inbound?: boolean }[];
  members: { user_id: string; personal_whatsapp_number: string }[];
  mode: DistributionMode;
  gestorNum: string;
  horarioOn: boolean;
  janelas: RoletaHoursWindow[];
  /** Como o número se chama na tela. */
  instanceLabel: (inboxId: string) => string;
  /** Como o corretor se chama na tela. */
  userName: (userId: string) => string;
}

// Mesmo formato que o backend aceita (HH:MM, 00:00–23:59).
const HORA_VALIDA = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function roletaFormProblems(f: RoletaFormCheckInput): string[] {
  const p: string[] = [];

  // A mensagem aponta o campo que o gestor está VENDO: com o bloco de números
  // visível o seletor separado não existe, e mandar procurar "a instância"
  // levaria a um campo que não está na tela.
  if (!f.inboxId.trim()) {
    p.push(f.multiEnabled
      ? 'Escolha o número de entrada na primeira linha de "Números que atendem".'
      : 'Selecione a instância (WhatsApp) da roleta.');
  }

  // ⚠️ Compartilhar o mesmo WhatsApp entre roletas é PERMITIDO — foi o pedido de
  // 07/08/2026 (duas campanhas, fontes diferentes, mesmo número). O que continua
  // sendo exclusivo é a marcação "atende quem escreve direto": só uma roleta por
  // número pode tê-la, senão o lead que escrevesse para o número cairia numa ou
  // noutra conforme a ordem das linhas no banco.
  f.instances
    .filter(i => i.inbox_id && i.answers_direct_inbound)
    .forEach(i => {
      const outra = f.configs.find(c => c.id !== f.editingId
        && (c.instances ?? []).some(x => x.inbox_id === i.inbox_id && x.answers_direct_inbound));
      if (!outra) return;
      p.push(`A roleta "${outra.display_name || outra.inbox_name || 'sem nome'}" já é quem atende quem escreve `
        + `direto para o número "${f.instanceLabel(i.inbox_id)}". Só uma roleta por número pode ter essa `
        + 'marcação — desmarque lá antes de marcar aqui.');
    });

  // Duas linhas no mesmo número: o backend guarda uma instância por número, e a
  // segunda sobrescreveria a primeira sem avisar.
  const numeros = f.instances.filter(i => i.inbox_id).map(i => i.inbox_id);
  const repetido = numeros.find((id, i) => numeros.indexOf(id) !== i);
  if (repetido) {
    p.push(`O número "${f.instanceLabel(repetido)}" está em duas linhas de "Números que atendem". Deixe só uma.`);
  }

  if (!f.multiEnabled && f.instances.filter(i => i.is_active && i.inbox_id).length > 1) {
    p.push('A roleta com mais de um número não está liberada para este cliente. '
      + 'Fale com a Leal Mídia para habilitar, ou deixe só um número ativo.');
  }

  if (!f.gestorNum.trim()) {
    p.push('Preencha o número do gestor (é quem recebe os avisos da roleta).');
  }

  // No modo Manual o gerente distribui na mão, então não precisa de corretor.
  const completos = f.members.filter(m => m.user_id && m.personal_whatsapp_number?.trim());
  if (f.mode !== 'manual' && completos.length === 0) {
    p.push('Adicione ao menos um corretor com número de WhatsApp.');
  }

  // Linha pela metade era DESCARTADA no silêncio: o gestor escolhia o corretor,
  // esquecia o WhatsApp, salvava com sucesso — e o corretor não estava lá.
  f.members.forEach((m, i) => {
    if (m.user_id && !m.personal_whatsapp_number?.trim()) {
      p.push(`Falta o WhatsApp de ${f.userName(m.user_id)} — sem ele o corretor não entra na roleta.`);
    }
    if (!m.user_id && m.personal_whatsapp_number?.trim()) {
      p.push(`A linha ${i + 1} de corretores tem WhatsApp mas nenhum corretor escolhido.`);
    }
  });

  // O backend guarda um registro por corretor: o segundo apagaria o primeiro.
  const escolhidos = f.members.filter(m => m.user_id).map(m => m.user_id);
  const duplicado = escolhidos.find((id, i) => escolhidos.indexOf(id) !== i);
  if (duplicado) {
    p.push(`${f.userName(duplicado)} está na lista duas vezes. Deixe só uma linha.`);
  }

  // Horário de funcionamento — as mesmas regras que o backend recusa.
  if (f.horarioOn) {
    if (f.janelas.length === 0) {
      p.push('O horário de funcionamento está ligado mas não tem nenhuma faixa de horário.');
    }
    f.janelas.forEach(j => {
      const inicio = (j.start ?? '').trim();
      const fim    = (j.end ?? '').trim();
      if (!HORA_VALIDA.test(inicio) || !HORA_VALIDA.test(fim)) {
        p.push(`Horário inválido na faixa "${inicio || '—'} às ${fim || '—'}". Use o formato 08:00.`);
      } else if (inicio === fim) {
        p.push(`A faixa "${inicio} às ${fim}" começa e termina no mesmo horário — a roleta nunca abriria.`);
      }
    });
  }

  return p;
}

/**
 * A recusa do servidor, quebrada em uma linha por campo.
 *
 * O backend junta os problemas com " | " (um por campo, já com o rótulo da tela
 * na frente). Quebrar aqui é o que faz duas recusas simultâneas virarem dois
 * itens da lista em vez de um parágrafo corrido.
 */
export function splitBackendProblems(message: string): string[] {
  const linhas = message.split(' | ').map(s => s.trim()).filter(Boolean);
  return linhas.length > 0 ? linhas : [message];
}

// Mensagens que o tratador global do backend emite sem dizer nada de útil. O
// motivo real, nesses casos, está só no `details`.
const MENSAGENS_VAZIAS = ['validation failed', 'record invalid', 'bad request'];

interface BackendErrorDetail {
  field?: string;
  label?: string;
  message?: string;
  messages?: string[];
  full_messages?: string[];
}

/**
 * Os motivos da recusa, preferindo o `details` quando a mensagem não diz nada.
 *
 * ⚠️ Quando o estouro sobe pelo tratador global (e não pelas recusas nomeadas do
 * controlador da roleta), a mensagem é a string fixa "Validation failed" — em
 * inglês e sem nenhuma informação. Foi o que aconteceu ao tentar pôr o mesmo
 * número em duas roletas: o único texto útil estava no `details`, que a tela
 * nem olhava. Sem isto, o painel mostraria "Validation failed" e o gestor
 * continuaria sem saber o que houve.
 */
export function backendProblems(message: string, details?: BackendErrorDetail[] | null): string[] {
  const linhas = (details ?? []).flatMap(d => {
    const textos = d.full_messages?.length ? d.full_messages
      : d.messages?.length ? d.messages
      : d.message ? [d.message]
      : [];
    return textos.map(t => (d.label ? `${d.label}: ${t}` : t));
  }).filter(Boolean);

  if (MENSAGENS_VAZIAS.includes(message.trim().toLowerCase())) {
    return linhas.length > 0 ? linhas : [
      'O servidor recusou o salvamento sem detalhar o motivo. '
      + 'Confira os números e os corretores desta roleta.',
    ];
  }
  return splitBackendProblems(message);
}
