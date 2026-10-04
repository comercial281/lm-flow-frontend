// ÍCONE E FRASE DE CADA BLOCO (sprint 4, spec 04/10/2026, seção A).
//
// O painel Blocos mostra ícone + nome, e o painel lateral do bloco abre com o
// ícone, o nome e uma linha dizendo o que o bloco faz. Os dois leem daqui pra
// falarem a mesma coisa. O NOME continua em `blockLabel` (palette.ts); aqui só
// o que vai junto dele.

import {
  ArrowRightLeft, Bell, BellRing, Clock, Eraser, FileText, Filter, GitBranch, Hourglass, Image,
  ListOrdered, Megaphone, MessageSquare, Mic, Repeat, Send, Shuffle, Smartphone, Sticker, Tag,
  Trophy, User, UserCheck, ClipboardList, Users, Video, Zap, type LucideIcon,
} from 'lucide-react';
import type { FlowAutomationNode, FlowNodeConfig, FlowNodeKind } from '@/types/flowAutomations';
import { isLeadActionType } from './leadAction';

/** O que identifica o bloco no painel: o tipo, ou `lead_action:<ação>`. */
export function blockKey(node: { kind: FlowNodeKind; config?: FlowNodeConfig | null }): string {
  if (node.kind === 'lead_action' && isLeadActionType(node.config?.action_type)) {
    return `lead_action:${String(node.config?.action_type)}`;
  }
  return node.kind;
}

const ICONS: Record<string, LucideIcon> = {
  send_whatsapp: MessageSquare,
  wait: Clock,
  wait_for_reply: Hourglass,
  condition: GitBranch,
  filter_label: Filter,
  add_label: Tag,
  remove_label: Eraser,
  move_stage: ArrowRightLeft,
  followup_recovered: Trophy,
  'lead_action:send_whatsapp_message': MessageSquare,
  'lead_action:send_audio': Mic,
  'lead_action:send_image': Image,
  'lead_action:send_video': Video,
  'lead_action:send_document': FileText,
  'lead_action:send_sticker': Sticker,
  'lead_action:send_quick_reply': Send,
  'lead_action:send_message_funnel': ListOrdered,
  'lead_action:add_label': Tag,
  'lead_action:remove_label': Eraser,
  'lead_action:move_pipeline_stage': ArrowRightLeft,
  'lead_action:assign_broker': UserCheck,
  'lead_action:assign_via_roleta': Shuffle,
  'lead_action:create_task': ClipboardList,
  'lead_action:start_followup_sequence': Repeat,
  'lead_action:start_followup_flow': Repeat,
  'lead_action:notify_group': Users,
  'lead_action:notify_user': User,
  'lead_action:notify_broker': Megaphone,
  'lead_action:notify_gestor': BellRing,
  'lead_action:notify_push': Smartphone,
};

const DESCRIPTIONS: Record<string, string> = {
  send_whatsapp: 'Manda uma mensagem de texto pro lead no WhatsApp.',
  wait: 'Segura o fluxo um tempo antes de seguir pro próximo bloco.',
  wait_for_reply: 'Espera o lead responder e segue por um caminho ou pelo outro.',
  condition: 'Confere algo do lead e segue pelo Sim ou pelo Não.',
  filter_label: 'Só deixa o fluxo seguir se o lead passar na regra.',
  add_label: 'Coloca etiquetas no lead.',
  remove_label: 'Tira etiquetas do lead.',
  move_stage: 'Leva o card do lead pra outra etapa do funil.',
  followup_recovered: 'Marca que o lead voltou a conversar graças ao follow-up.',
  'lead_action:send_whatsapp_message': 'Manda uma mensagem de texto pro lead no WhatsApp.',
  'lead_action:send_audio': 'Manda um áudio pro lead.',
  'lead_action:send_image': 'Manda uma imagem pro lead, com legenda se quiser.',
  'lead_action:send_video': 'Manda um vídeo pro lead, com legenda se quiser.',
  'lead_action:send_document': 'Manda um arquivo pro lead (PDF, planilha…).',
  'lead_action:send_sticker': 'Manda uma figurinha pro lead.',
  'lead_action:send_quick_reply': 'Manda uma das respostas rápidas da equipe.',
  'lead_action:send_message_funnel': 'Manda uma sequência pronta de mensagens.',
  'lead_action:add_label': 'Coloca uma etiqueta no lead.',
  'lead_action:remove_label': 'Tira uma etiqueta do lead.',
  'lead_action:move_pipeline_stage': 'Leva o card do lead pra outra etapa do funil.',
  'lead_action:assign_broker': 'Escolhe o corretor responsável pelo lead.',
  'lead_action:assign_via_roleta': 'Escolhe o corretor pela roleta.',
  'lead_action:create_task': 'Cria uma tarefa pra alguém da equipe.',
  'lead_action:start_followup_sequence': 'Coloca o lead num follow-up do formato antigo.',
  'lead_action:start_followup_flow': 'Coloca o lead num follow-up.',
  'lead_action:notify_group': 'Manda um aviso num grupo de WhatsApp.',
  'lead_action:notify_user': 'Manda um aviso pra uma pessoa da equipe.',
  'lead_action:notify_broker': 'Avisa o corretor responsável pelo lead.',
  'lead_action:notify_gestor': 'Avisa o gestor.',
  'lead_action:notify_push': 'Manda uma notificação pro celular da equipe.',
};

/** Ícone do bloco no painel Blocos e no topo do painel lateral. */
export function blockIcon(node: { kind: FlowNodeKind; config?: FlowNodeConfig | null }): LucideIcon {
  return ICONS[blockKey(node)] ?? (node.kind === 'lead_action' ? Bell : Zap);
}

/** Uma linha dizendo o que o bloco faz. Bloco sem frase própria: vazio. */
export function blockDescription(node: Pick<FlowAutomationNode, 'kind' | 'config'> | { kind: FlowNodeKind; config?: FlowNodeConfig | null }): string {
  return DESCRIPTIONS[blockKey(node)] ?? '';
}
