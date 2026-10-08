// src/features/cardDoLead/blocos/DialogosDoCard.tsx
// As janelas que o card abre por cima: corrigir telefone/e-mail, agendar envio,
// tirar da roleta, juntar contatos e iniciar conversa.
import { Suspense } from 'react';
import { lazyWithRetry } from '@/utils/chunkReload';
import { avisarAgendadosMudaram } from '@/features/conversas/agendados';
import type { Contact } from '@/types/contacts';
import type { CardDoLead } from '../useCardDoLead';

const RemoveFromRoletaDialog = lazyWithRetry(() => import('@/components/roleta/RemoveFromRoletaDialog'));
const CorrigirContatoDialog = lazyWithRetry(() => import('@/components/pipelines/card/CorrigirContatoDialog'));
const JuntarContato = lazyWithRetry(() => import('@/components/pipelines/card/JuntarContato'));
const ScheduleActionModal = lazyWithRetry(() =>
  import('@/components/scheduledActions/ScheduleActionModal').then(m => ({ default: m.ScheduleActionModal })),
);

export default function DialogosDoCard({ card, onJuntado }: {
  card: CardDoLead;
  /** Juntou com outro contato: o aberto pode ter sumido. */
  onJuntado: () => void;
}) {
  const { contato, identidade, envio, roleta, juntar, conversa } = card;
  return (
    <>
      {identidade.corrigindo && contato?.id != null && (
        <Suspense fallback={null}>
          <CorrigirContatoDialog
            open={identidade.corrigindo}
            onOpenChange={identidade.setCorrigindo}
            contactId={String(contato.id)}
            telefoneAtual={identidade.telefone}
            emailAtual={identidade.email}
            onCorrigido={identidade.aoCorrigir}
          />
        </Suspense>
      )}

      {envio.agendando !== null && contato?.id != null && (
        <Suspense fallback={null}>
          <ScheduleActionModal
            open
            onClose={() => {
              envio.setAgendando(null);
              // O painel do lead ao lado da conversa relê a seção Agendados.
              avisarAgendadosMudaram(contato.id);
            }}
            contactId={String(contato.id)}
            mensagemInicial={envio.agendando}
          />
        </Suspense>
      )}

      {/* Tirar da roleta — o destino do lead é escolhido no diálogo. */}
      {roleta.tirando && contato?.id != null && (
        <Suspense fallback={null}>
          <RemoveFromRoletaDialog
            open
            onOpenChange={roleta.setTirando}
            contactId={String(contato.id)}
            leadName={contato.name ?? undefined}
            offers={roleta.ofertasAbertas}
            onDone={() => {
              roleta.setOfertasAbertas([]);
              // O passo da roleta (Rodízios) entra no Histórico.
              card.historico.recarregar();
            }}
          />
        </Suspense>
      )}

      {juntar.juntando && contato?.id != null && (
        <Suspense fallback={null}>
          <JuntarContato
            contato={contato as unknown as Contact}
            onFechar={() => juntar.setJuntando(false)}
            onJuntado={() => {
              juntar.setJuntando(false);
              onJuntado();
            }}
          />
        </Suspense>
      )}

      {/* Iniciar conversa — só monta para lead que ainda não tem conversa */}
      {conversa.janelaDeInicio}
    </>
  );
}
