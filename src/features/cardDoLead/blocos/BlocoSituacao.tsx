// src/features/cardDoLead/blocos/BlocoSituacao.tsx
// Situação do lead na janela: Etapa e Responsável lado a lado (economiza altura
// na coluna fixa), "veio pela Roleta X", a oferta que espera o próprio usuário e
// o aviso de sorteio em aberto. Os pedaços saem sozinhos para a página: lá a
// etapa é a faixa e o responsável vai no cabeçalho.
//
// Os campos de Etapa e Responsável são os da Parte 1 (CamposDaSituacao: nome
// longo corta com reticências e o title mostra inteiro). Aqui só se ligam ao
// card — nunca um segundo seletor de etapa/responsável.
import { Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import OfferActions from '@/components/roleta/OfferActions';
import ColocarNoFunil from '@/components/pipelines/card/ColocarNoFunil';
import { CampoEtapa, CampoResponsavel } from '@/components/pipelines/card/CamposDaSituacao';
import { ETAPA_TRAVADA } from '@/features/pipelines/situacao/situacao';
import { conversaDoCard } from '../cardDoLead';
import type { CardDoLead } from '../useCardDoLead';

// Card ganho/perdido não muda de etapa (Parte 3): o campo trava e diz por quê.
// Enquanto o rodapé grava Ganho/Perdido/Reabrir, a Etapa espera (e vice-versa).
export function EtapaDoCard({ card }: { card: CardDoLead }) {
  const { etapa, situacao } = card;
  return (
    <div className="grid min-w-0 gap-1">
      <CampoEtapa
        stages={etapa.opcoes}
        etapaId={etapa.id}
        onMover={etapa.mover}
        disabled={etapa.movendo || situacao.fechado || situacao.rodapeSalvando}
      />
      {situacao.fechado && (
        <span className="text-[11px] leading-tight text-muted-foreground">{ETAPA_TRAVADA}</span>
      )}
    </div>
  );
}

export function ResponsavelDoCard({ card }: { card: CardDoLead }) {
  const { responsavel } = card;
  return (
    <CampoResponsavel
      users={responsavel.usuarios}
      responsavelId={responsavel.id}
      onTrocar={responsavel.trocar}
      carregando={responsavel.salvando}
    />
  );
}

/** Cabeçalho da página do card: a foto do responsável ao lado do campo. */
export function ResponsavelComFoto({ card }: { card: CardDoLead }) {
  const { responsavel, item } = card;
  // A foto é a do responsável ATUAL (após "Trocar" e a foto acompanha o nome).
  const atual = responsavel.usuarios.find(u => String(u.id) === responsavel.id);
  // Responsável que não está na lista de usuários (desligado, fora do cargo):
  // cai na foto do assignee do card, se for o mesmo id.
  const doCard = item?.assignee && String(item.assignee.id) === responsavel.id ? item.assignee : null;
  const nome = atual?.name ?? doCard?.name ?? 'Sem responsável';
  return (
    <div className="flex min-w-0 items-end gap-2">
      <ContactAvatar
        contact={{ name: nome, avatar_url: atual?.avatar_url ?? atual?.thumbnail ?? doCard?.avatar_url ?? null }}
        size="sm"
        showColoredFallback
        className="mb-1 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <ResponsavelDoCard card={card} />
      </div>
    </div>
  );
}

export function AvisosDaRoleta({ card }: { card: CardDoLead }) {
  const { item, contato, roletaDoLead, roleta } = card;
  if (!item) return null;
  return (
    <>
      {roletaDoLead && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Shuffle className="h-3.5 w-3.5" /> veio pela {roletaDoLead}
        </span>
      )}

      {/* A oferta que espera o PRÓPRIO usuário — o corretor aceita daqui. */}
      <OfferActions
        contactId={contato?.id != null ? String(contato.id) : undefined}
        conversationId={item.conversation?.id}
        onAccepted={card.aoAceitarOferta}
      />
      {roleta.ofertasAbertas.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            No sorteio agora, esperando o aceite de{' '}
            <strong>{roleta.ofertasAbertas.map(o => o.corretor ?? 'corretor').join(', ')}</strong>.
          </p>
          <Button variant="outline" size="sm" className="mt-1.5 h-7 text-xs" onClick={() => roleta.setTirando(true)}>
            Tirar da roleta
          </Button>
        </div>
      )}
    </>
  );
}

export default function BlocoSituacao({ card, onColocadoNoFunil }: {
  card: CardDoLead;
  /** Card sem funil (aberto de Contatos): o contato entrou num funil pelo card. */
  onColocadoNoFunil?: () => void;
}) {
  const { item, contato, foraDoFunil } = card;
  if (!item) return null;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {foraDoFunil ? (
          contato?.id != null && onColocadoNoFunil ? (
            <ColocarNoFunil contactId={String(contato.id)} conversationId={conversaDoCard(item)} onColocado={onColocadoNoFunil} />
          ) : <div />
        ) : (
          <EtapaDoCard card={card} />
        )}
        {/* Responsável sem depender de conversa: lead de formulário também tem dono. */}
        {(item.conversation?.id || contato?.id) && <ResponsavelDoCard card={card} />}
      </div>
      <AvisosDaRoleta card={card} />
    </div>
  );
}
