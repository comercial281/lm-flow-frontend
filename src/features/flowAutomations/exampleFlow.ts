// O EXEMPLO PRONTO DO ESTADO VAZIO (spec 02/10, seção 7): "Primeiro contato
// com nova tentativa". É o caso que motivou a sprint: a primeira mensagem sai
// pelo número do responsável (onde a IA Vendedora dele está ligada), espera 30
// minutos e, se o lead não responder, tenta de novo. Se responder, a IA segue.
//
// Montado aqui na tela com as rotas que já existem (criar, gravar o gatilho,
// gravar os blocos): não precisa de rota nova no servidor.

import type { SaveFlowPayload } from '@/types/flowAutomations';
import type { FlowTrigger } from './trigger';

export const EXAMPLE_FLOW_NAME = 'Primeiro contato com nova tentativa';

export const EXAMPLE_FLOW_DESCRIPTION =
  'Lead criado → mensagem pelo número do responsável → aguarda a resposta por 30 minutos → se não responder, manda outra mensagem.';

// Variáveis do construtor: {{first_name}} é o primeiro nome do lead.
const FIRST_MESSAGE =
  'Oi {{first_name}}, tudo bem? Vi que você se interessou e queria te ajudar. Posso te mandar mais informações?';
const SECOND_MESSAGE =
  '{{first_name}}, conseguiu ver minha mensagem? Se preferir, me diz o melhor horário que eu te chamo.';

export function buildExampleFlow(): { trigger: FlowTrigger; flow: SaveFlowPayload } {
  const first = 'tmp_exemplo_1';
  const wait = 'tmp_exemplo_2';
  const retry = 'tmp_exemplo_3';
  const base = { label: null, pos_x: null, pos_y: null, steps: [] };
  return {
    trigger: { event: 'lead.created', conditions: [] },
    flow: {
      initial_node_id: first,
      nodes: [
        {
          ...base,
          id: first,
          kind: 'send_whatsapp',
          config: { text: FIRST_MESSAGE, send_from: 'owner', send_from_inbox_id: '' },
          next_node_id: wait,
          next_yes_node_id: null,
          next_no_node_id: null,
        },
        {
          ...base,
          id: wait,
          kind: 'wait_for_reply',
          config: { minutes: 30, indefinite: false },
          next_node_id: null,
          next_yes_node_id: null,
          next_no_node_id: retry,
        },
        {
          ...base,
          id: retry,
          kind: 'send_whatsapp',
          config: { text: SECOND_MESSAGE, send_from: 'owner', send_from_inbox_id: '' },
          next_node_id: null,
          next_yes_node_id: null,
          next_no_node_id: null,
        },
      ],
    },
  };
}
