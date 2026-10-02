import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import CapiConversionPanel from '@/components/capi/CapiConversionPanel';
import { pipelinesService } from '@/services/pipelines';
import { contactsService } from '@/services/contacts/contactsService';
import { origemDoLead, outraConversa } from '@/features/conversas/painelDoLead';
import type { Pipeline } from '@/types/analytics';
import type { ContactConversation } from '@/types/contacts';
import type { Contact, Conversation } from '@/types/chat/api';

import AiUnderstandingPanel from './AiUnderstandingPanel';
import TopoDoLead from './painel/TopoDoLead';
import SecaoFunil from './painel/SecaoFunil';
import SecaoEtiquetas from './painel/SecaoEtiquetas';
import SecaoNotas from './painel/SecaoNotas';
import SecaoRespostas from './painel/SecaoRespostas';

interface ContactSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  conversation: Conversation | null;
  onFilterReload?: () => Promise<void>;
  /** A roleta ofertou este lead a quem está vendo e ainda não houve aceite. */
  emOferta?: boolean;
}

type Objeto = Record<string, unknown>;

const anuncioDe = (attrs: unknown): Objeto | null => {
  const ref = (attrs as Objeto | null | undefined)?.ad_referral;
  return ref && typeof ref === 'object' ? (ref as Objeto) : null;
};

/**
 * O painel do lead ao lado da conversa: seções simples, uma embaixo da outra,
 * com o conteúdo à vista. Topo → Funil → O que a IA entendeu → Etiquetas →
 * Notas → Respostas do formulário → Conversão Meta.
 */
const ContactSidebar: React.FC<ContactSidebarProps> = ({
  isOpen,
  onClose,
  contact,
  conversation,
  onFilterReload,
  emOferta = false,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [conversationPipelines, setConversationPipelines] = useState<Pipeline[]>([]);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);
  const [conversasDoContato, setConversasDoContato] = useState<ContactConversation[]>([]);

  // Detectar se é mobile para controlar renderização
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Outras conversas do lead (a lista já vem recortada pela permissão do servidor).
  useEffect(() => {
    setConversasDoContato([]);
    if (!contact?.id) return;
    let vivo = true;
    contactsService
      .getContactConversations(String(contact.id))
      .then(res => { if (vivo) setConversasDoContato(res.data ?? []); })
      .catch(() => { if (vivo) setConversasDoContato([]); });
    return () => { vivo = false; };
  }, [contact?.id]);

  // Funis desta conversa: alimentam a seção Funil e a origem do lead ("Veio de").
  // A resposta de uma conversa que já foi trocada não pode cair na seguinte.
  const conversaAtual = useRef(conversation?.id);
  conversaAtual.current = conversation?.id;

  const loadConversationPipelines = useCallback(async () => {
    if (!conversation?.id) {
      setConversationPipelines([]);
      return;
    }

    const pedida = conversation.id;
    setIsLoadingPipelines(true);
    try {
      const pipelines = await pipelinesService.getPipelinesByConversation(pedida);
      if (pedida === conversaAtual.current) setConversationPipelines(pipelines);
    } catch (error) {
      console.error('Error loading conversation pipelines:', error);
      if (pedida === conversaAtual.current) setConversationPipelines([]);
    } finally {
      if (pedida === conversaAtual.current) setIsLoadingPipelines(false);
    }
  }, [conversation?.id]);

  useEffect(() => {
    setConversationPipelines([]);
    loadConversationPipelines();
  }, [loadConversationPipelines]);

  // Handler para recarregar pipelines quando houver atualização
  const handlePipelineUpdated = useCallback(async () => {
    await loadConversationPipelines();
    onFilterReload?.();
  }, [loadConversationPipelines, onFilterReload]);

  // Calcular altura real do header dinamicamente
  useEffect(() => {
    const calculateHeaderHeight = () => {
      // Procurar o AppBar do MainLayout
      const appBar = document.querySelector(
        '[class*="flex-shrink-0"][class*="bg-sidebar"][class*="border-b"]',
      );
      if (appBar) {
        const height = appBar.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    calculateHeaderHeight();
    window.addEventListener('resize', calculateHeaderHeight);
    return () => window.removeEventListener('resize', calculateHeaderHeight);
  }, []);

  const origem = useMemo(() => {
    const comOrigem = conversationPipelines
      .flatMap(p => p.stages ?? [])
      .flatMap(s => s.items ?? [])
      .find(item => item.lead_origin);
    return origemDoLead({
      leadOrigin: comOrigem?.lead_origin ?? null,
      adReferral: anuncioDe(conversation?.additional_attributes) ?? anuncioDe(contact?.additional_attributes),
    });
  }, [conversationPipelines, conversation?.additional_attributes, contact?.additional_attributes]);

  const outra = useMemo(
    () => (conversation ? outraConversa(conversasDoContato, conversation.id) : null),
    [conversasDoContato, conversation],
  );

  // No mobile, esconder completamente quando fechado
  // No desktop, manter no DOM para animação
  if (!isOpen && isMobile) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && isMobile && (
        <div
          className="fixed left-0 right-0 bottom-0 bg-black/50 z-30"
          style={{ top: 'var(--header-height, 60px)' }}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        border-l bg-background flex flex-col
        fixed md:static left-0 md:left-auto right-0 md:right-auto bottom-0 md:bottom-auto z-40 md:z-auto
        transform transition-all duration-300 ease-in-out overflow-hidden
        ${isOpen
            ? 'w-full md:w-96 translate-x-0 md:translate-x-0 md:opacity-100'
            : 'w-full md:w-0 translate-x-full md:translate-x-0 md:opacity-0'
          }
      `}
        style={{
          top: isMobile ? 'var(--header-height, 60px)' : 'auto',
          height: isMobile ? 'calc(100vh - var(--header-height, 60px))' : '100%',
        }}
      >
        <div className="border-b flex-shrink-0">
          <TopoDoLead contact={contact} emOferta={emOferta} origem={origem} outra={outra} onClose={onClose} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          {conversation && (
            <SecaoFunil
              key={`funil-${conversation.id}`}
              conversationId={String(conversation.id)}
              pipelines={conversationPipelines}
              carregando={isLoadingPipelines}
              onAtualizado={handlePipelineUpdated}
            />
          )}

          {/* Some sozinho em conversa sem IA. */}
          <AiUnderstandingPanel conversation={conversation} embutido />

          {contact && (
            <SecaoEtiquetas
              key={`etiquetas-${contact.id}`}
              contactId={String(contact.id)}
              conversationId={conversation ? String(conversation.id) : undefined}
              initialLabels={(contact as { labels?: Array<{ name?: string; title?: string; color?: string }> }).labels}
              onUpdated={onFilterReload}
            />
          )}

          {contact && <SecaoNotas key={`notas-${contact.id}`} contactId={String(contact.id)} />}

          {contact && <SecaoRespostas key={`respostas-${contact.id}`} contact={contact} />}

          {/* Conversão Meta (Pixel/CAPI): some sozinho quando o cliente não usa CAPI. */}
          <CapiConversionPanel contactId={contact?.id ?? null} className="m-4" />
        </div>
      </div>
    </>
  );
};

export default ContactSidebar;
