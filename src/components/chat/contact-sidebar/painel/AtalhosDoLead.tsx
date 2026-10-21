import { Suspense, useState } from 'react';
import { Bot, BotOff, CalendarClock, MapPin, Rocket, UserCheck } from 'lucide-react';

import IconActionButton from '@/components/base/IconActionButton';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { useCan } from '@/hooks/useCan';
import { avisarAgendadosMudaram } from '@/features/conversas/agendados';
import { dicaDaIa, iaNoNumero, leadDoPainelParaVisita } from '@/features/conversas/atalhosDoLead';
import { useIaDaConversa } from '@/features/conversas/useIaDaConversa';
import { useColocarEmFollowup } from '@/features/followup/useColocarEmFollowup';
import { conversationAPI } from '@/services/conversations/conversationService';
import { lazyWithRetry } from '@/utils/chunkReload';
import type { Pipeline } from '@/types/analytics';
import type { Contact, Conversation } from '@/types/chat/api';

const ScheduleActionModal = lazyWithRetry(() =>
  import('@/components/scheduledActions/ScheduleActionModal').then(m => ({ default: m.ScheduleActionModal })),
);
const ScheduleVisitDialog = lazyWithRetry(() =>
  import('@/components/visits/ScheduleVisitDialog').then(m => ({ default: m.ScheduleVisitDialog })),
);

const VISIT_SCHEDULED_LABEL = 'visita-agendada';

// Botão redondo, só o ícone (o nome aparece ao passar o mouse), como no CRM do LM Hub.
const REDONDO = 'h-9 w-9 rounded-full';

interface AtalhosDoLeadProps {
  contact: Contact | null;
  conversation: Conversation | null;
  /** Os funis desta conversa: a visita já abre com o funil e o responsável do card. */
  pipelines: Pipeline[];
  /** Nome como aparece no topo do painel. */
  nome: string;
  emOferta: boolean;
  /** Pôs o lead no follow-up: o painel relê os funis (o card foi pra coluna Follow-up). */
  aoColocarEmFollowup?: () => void;
}

/**
 * A fileira de atalhos do painel do lead (07/10/2026): Agendar mensagem · IA ·
 * Agendar visita · Follow-up (20/10/2026, abre a janela "Colocar em follow-up"
 * com a conversa). Cada botão só existe quando a ação existe; sem nenhum, a
 * fileira some.
 */
export default function AtalhosDoLead({ contact, conversation, pipelines, nome, emOferta, aoColocarEmFollowup }: AtalhosDoLeadProps) {
  const canScheduleAction = useFeature('card_schedule_action');
  const ia = useIaDaConversa(conversation?.id);
  const [agendando, setAgendando] = useState(false);
  const [visitaAberta, setVisitaAberta] = useState(false);
  const followup = useColocarEmFollowup();
  const pode = useCan();

  const contatoId = contact?.id != null ? String(contact.id) : null;
  // As duas janelas mostram o telefone do lead: fora durante a oferta da roleta.
  // Agendar mensagem segue a mesma chave do "Agendar envio" do card e do "⋮".
  const podeAgendar = canScheduleAction && contatoId != null && !emOferta;
  const lead = emOferta ? null : leadDoPainelParaVisita(contact, pipelines, nome);
  const temIa = iaNoNumero(ia.estado);
  // Na oferta da roleta só o robô fica (decisão de 07/10): o follow-up é de quem aceitou.
  // Sem `pipeline_items.update` o servidor recusa o place: o botão nem aparece.
  const conversaId = !emOferta && conversation?.id != null && pode('pipeline_items', 'update')
    ? String(conversation.id)
    : null;

  if (!podeAgendar && !temIa && !lead && !conversaId) return null;

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Atalhos do lead">
      {podeAgendar && (
        <IconActionButton
          label="Agendar mensagem"
          icon={<CalendarClock className="h-4 w-4" />}
          onClick={() => setAgendando(true)}
          className={REDONDO}
        />
      )}

      {temIa && ia.estado && (
        <IconActionButton
          label={dicaDaIa(ia.estado)}
          icon={
            ia.estado.status === 'handoff' ? (
              <UserCheck className="h-4 w-4" />
            ) : ia.ligada ? (
              <Bot className="h-4 w-4" />
            ) : (
              <BotOff className="h-4 w-4" />
            )
          }
          onClick={ia.trocar}
          disabled={ia.trocando}
          // Mesmas cores do robô do topo da conversa.
          className={`${REDONDO} ${
            ia.estado.status === 'active'
              ? 'border-violet-300 bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400'
              : ia.estado.status === 'handoff'
                ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400'
                : 'text-muted-foreground'
          }`}
        />
      )}

      {lead && (
        <IconActionButton
          label="Agendar visita"
          icon={<MapPin className="h-4 w-4" />}
          onClick={() => setVisitaAberta(true)}
          className={REDONDO}
        />
      )}

      {conversaId && (
        <IconActionButton
          label="Follow-up"
          icon={<Rocket className="h-4 w-4" />}
          onClick={() => followup.abrir({ conversationId: conversaId }, { aoConfirmar: () => aoColocarEmFollowup?.() })}
          className={REDONDO}
        />
      )}

      {followup.janela}

      {agendando && contatoId && (
        <Suspense fallback={null}>
          <ScheduleActionModal
            open
            contactId={contatoId}
            onClose={() => {
              setAgendando(false);
              avisarAgendadosMudaram(contatoId);
            }}
          />
        </Suspense>
      )}

      {visitaAberta && lead && (
        <Suspense fallback={null}>
          <ScheduleVisitDialog
            open={visitaAberta}
            onOpenChange={setVisitaAberta}
            leadInicial={lead}
            onCreated={() => {
              setVisitaAberta(false);
              // A mesma etiqueta que o "Agendar visita" do card põe.
              if (conversation?.id != null) {
                conversationAPI.addLabels(String(conversation.id), [VISIT_SCHEDULED_LABEL]).catch(() => {});
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
