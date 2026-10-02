import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import CapiConversionPanel from '@/components/capi/CapiConversionPanel';
import { pipelinesService } from '@/services/pipelines';
import { contactsService } from '@/services/contacts/contactsService';
import { origemDoLead, outraConversa } from '@/features/conversas/painelDoLead';
import { useNumerosDaConversa } from '@/features/numbers/useNumerosDaConversa';
import type { Pipeline } from '@/types/analytics';
import type { ContactConversation } from '@/types/contacts';
import type { Contact, Conversation } from '@/types/chat/api';

import AiUnderstandingPanel from './AiUnderstandingPanel';
import TopoDoLead from './painel/TopoDoLead';
import FaixaDeSelos from './painel/FaixaDeSelos';
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
 * O painel do lead ao lado da conversa (Proposta B, 02/10): o resumo no topo e
 * seções simples, uma embaixo da outra, com o conteúdo à vista. Topo (com a
 * faixa de selos) → Conversão Meta (uma linha) → Funil → O que a IA entendeu →
 * Etiquetas → Notas → Respostas do formulário.
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
  // Cada lista guarda de quem ela é: logo depois de trocar de conversa, a da
  // anterior ainda está no estado e não pode aparecer nem por um quadro.
  const [funis, setFunis] = useState<{ de: string | null; pipelines: Pipeline[] }>({ de: null, pipelines: [] });
  const [outrasConversas, setOutrasConversas] = useState<{ de: string | null; lista: ContactConversation[] }>({
    de: null,
    lista: [],
  });

  const conversaId = conversation?.id != null ? String(conversation.id) : null;
  const contatoId = contact?.id != null ? String(contact.id) : null;
  const conversationPipelines = useMemo(
    () => (funis.de === conversaId ? funis.pipelines : []),
    [funis, conversaId],
  );
  // Carregando enquanto não chegou a lista DESTA conversa (sem "Colocar no funil" piscando).
  const isLoadingPipelines = funis.de !== conversaId;
  const conversasDoContato = useMemo(
    () => (outrasConversas.de === contatoId ? outrasConversas.lista : []),
    [outrasConversas, contatoId],
  );

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
    if (!contatoId) return;
    let vivo = true;
    contactsService
      .getContactConversations(contatoId)
      .then(res => { if (vivo) setOutrasConversas({ de: contatoId, lista: res.data ?? [] }); })
      .catch(() => { if (vivo) setOutrasConversas({ de: contatoId, lista: [] }); });
    return () => { vivo = false; };
  }, [contatoId]);

  // Funis desta conversa: alimentam a seção Funil e os selos de etapa e origem.
  // A resposta de uma conversa que já foi trocada não pode cair na seguinte.
  const conversaAtual = useRef(conversaId);
  conversaAtual.current = conversaId;

  const loadConversationPipelines = useCallback(async () => {
    if (!conversaId) return;

    const pedida = conversaId;
    try {
      const pipelines = await pipelinesService.getPipelinesByConversation(pedida);
      if (pedida === conversaAtual.current) setFunis({ de: pedida, pipelines });
    } catch (error) {
      console.error('Error loading conversation pipelines:', error);
      if (pedida === conversaAtual.current) setFunis({ de: pedida, pipelines: [] });
    }
  }, [conversaId]);

  useEffect(() => {
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

  // A temperatura que a IA gravou na conversa: a mesma fonte do "O que a IA entendeu".
  const temperatura = useMemo(() => {
    const valor = (conversation?.additional_attributes as Objeto | undefined)?.sales_agent_temperature;
    return typeof valor === 'string' ? valor : null;
  }, [conversation?.additional_attributes]);

  // A mesma lista de números que a tela de Conversas já buscou (sem requisição a mais):
  // dá o nome que o gestor deu ao número da outra conversa.
  const { inboxes: numeros } = useNumerosDaConversa();
  const outra = useMemo(
    () => (conversation ? outraConversa(conversasDoContato, conversation.id, numeros) : null),
    [conversasDoContato, conversation, numeros],
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
          <TopoDoLead
            contact={contact}
            emOferta={emOferta}
            selos={
              <FaixaDeSelos
                pipelines={conversationPipelines}
                temperatura={temperatura}
                origem={origem}
                conversa={conversation}
              />
            }
            outra={outra}
            onClose={onClose}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          {/* Conversão Meta (Pixel/CAPI), uma linha logo abaixo do resumo. Some
              sozinha quando o cliente não usa CAPI. */}
          <CapiConversionPanel
            contactId={contact?.id ?? null}
            variante="compacto"
            className="px-4 py-2 border-b border-border/60"
          />

          {conversation && (
            <SecaoFunil
              key={`funil-${conversation.id}`}
              conversationId={String(conversation.id)}
              pipelines={conversationPipelines}
              carregando={isLoadingPipelines}
              onAtualizado={handlePipelineUpdated}
              emOferta={emOferta}
            />
          )}

          {/* Some sozinho em conversa sem IA. */}
          <AiUnderstandingPanel key={`ia-${conversaId}`} conversation={conversation} embutido />

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

          {/* Formulário de lead costuma trazer telefone e e-mail: na oferta, a seção some. */}
          {contact && !emOferta && <SecaoRespostas key={`respostas-${contact.id}`} contact={contact} />}
        </div>
      </div>
    </>
  );
};

export default ContactSidebar;
