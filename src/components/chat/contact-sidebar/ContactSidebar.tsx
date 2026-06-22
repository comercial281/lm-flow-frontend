import React, { useState, useEffect, useCallback } from 'react';

import { useLanguage } from '@/hooks/useLanguage';

import { Button } from '@evoapi/design-system/button';
import { Card, CardHeader, CardContent } from '@evoapi/design-system/card';
import { Badge } from '@evoapi/design-system/badge';
import { X, User, FileText, MessageSquare, Clock, ChevronDown, GitBranch, Tag, Megaphone, ExternalLink } from 'lucide-react';

import ContactHeader from './ContactHeader';
import ContactDetails from './ContactDetails';
// import MacrosList from './MacrosList'; // OCULTO

import EditableContactCustomAttributes from './EditableContactCustomAttributes';
import ContactTagsManager from './ContactTagsManager';

import ConversationPipelineItem from '@/components/pipelines/ConversationPipelineItem';
import PipelineManagement from '@/components/chat/contact-sidebar/PipelineManagement';
import { pipelinesService } from '@/services/pipelines';
import type { Pipeline } from '@/types/analytics';

import { Contact, Conversation } from '@/types/chat/api';
import { contactsService } from '@/services/contacts/contactsService';

interface ContactSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  conversation: Conversation | null;
  onFilterReload?: () => Promise<void>;
}

// Componente CollapsibleHeader igual ao usado em Agents.tsx
interface CollapsibleHeaderProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  count?: number;
  isOpen: boolean;
  onToggle: () => void;
}

const CollapsibleHeader = ({
  title,
  description,
  icon,
  count,
  isOpen,
  onToggle,
}: CollapsibleHeaderProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 min-w-0 flex-1">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {count}
            </Badge>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground truncate">{description}</p>}
      </div>
    </div>
    <Button variant="ghost" size="sm" onClick={onToggle} className="h-6 w-6 p-0 flex-shrink-0">
      <div className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
        <ChevronDown className="h-3 w-3" />
      </div>
    </Button>
  </div>
);

const ContactSidebar: React.FC<ContactSidebarProps> = ({
  isOpen,
  onClose,
  contact,
  conversation,
  onFilterReload,
}) => {
  const { t } = useLanguage('chat');

  // Estados para controlar seções expandidas/colapsadas (padrão Agents.tsx)
  const [showContactDetails, setShowContactDetails] = useState(false);
  // const [showMacros, setShowMacros] = useState(false); // OCULTO
  const [showPipeline, setShowPipeline] = useState(false);
  const [showContactNotes, setShowContactNotes] = useState(false);
  const [showPreviousConversations, setShowPreviousConversations] = useState(false);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [showConversationAttributes, setShowConversationAttributes] = useState(false);
  const [showContactAttributes, setShowContactAttributes] = useState(false);
  const [showAdReferral, setShowAdReferral] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [conversationPipelines, setConversationPipelines] = useState<Pipeline[]>([]);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [prevConversations, setPrevConversations] = useState<any[]>([]);

  // Detectar se é mobile para controlar renderização
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Carregar notas e conversas anteriores do contato
  useEffect(() => {
    if (!contact?.id) {
      setNotes([]);
      setPrevConversations([]);
      return;
    }
    contactsService.getContactNotes(String(contact.id))
      .then(res => setNotes(res.data ?? []))
      .catch(() => setNotes([]));
    contactsService.getContactConversations(String(contact.id))
      .then(res => setPrevConversations(res.data ?? []))
      .catch(() => setPrevConversations([]));
  }, [contact?.id]);

  // Carregar pipelines da conversation uma única vez
  const loadConversationPipelines = useCallback(async () => {
    if (!conversation?.id) {
      setConversationPipelines([]);
      return;
    }

    setIsLoadingPipelines(true);
    try {
      const pipelines = await pipelinesService.getPipelinesByConversation(conversation.id);
      setConversationPipelines(pipelines);
    } catch (error) {
      console.error('Error loading conversation pipelines:', error);
      setConversationPipelines([]);
    } finally {
      setIsLoadingPipelines(false);
    }
  }, [conversation?.id]);

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
        {/* Header com Avatar e Info Básica + Close Button */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative">
          <ContactHeader contact={contact} />

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Cards Colapsáveis - Estrutura Agents.tsx */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 scrollbar-thin">
          {/* 1. Contact Details - Informações do contato */}
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleHeader
                title={t('contactSidebar.sections.contactDetails.title')}
                description={t('contactSidebar.sections.contactDetails.description')}
                icon={<User className="h-4 w-4 text-green-500" />}
                isOpen={showContactDetails}
                onToggle={() => setShowContactDetails(!showContactDetails)}
              />
            </CardHeader>

            {showContactDetails && (
              <CardContent className="pt-0 px-3 pb-3">
                <ContactDetails contact={contact} />
              </CardContent>
            )}
          </Card>

          {/* 2. Origem do Anuncio - so aparece quando tem externalAdReply */}
          {Boolean(conversation?.additional_attributes?.ad_referral) && (
            <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/20">
              <CardHeader className="pb-2">
                <CollapsibleHeader
                  title="Origem do Anuncio"
                  description={(conversation!.additional_attributes.ad_referral as any)?.title || 'Meta Ads'}
                  icon={<Megaphone className="h-4 w-4 text-orange-500" />}
                  isOpen={showAdReferral}
                  onToggle={() => setShowAdReferral(!showAdReferral)}
                />
              </CardHeader>

              {showAdReferral && (
                <CardContent className="pt-0 px-3 pb-3">
                  {(() => {
                    const ref = conversation!.additional_attributes.ad_referral as any;
                    const appLabel = ref.source_app === 'instagram' ? 'Instagram' : 'Facebook';
                    return (
                      <div className="space-y-2">
                        {ref.title && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Anuncio</span>
                            <span className="font-medium text-right max-w-[60%] truncate" title={ref.title}>{ref.title}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Plataforma</span>
                          <span className="font-medium">{appLabel}</span>
                        </div>
                        {ref.source_id && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">ID do Anuncio</span>
                            <span className="font-mono text-xs text-muted-foreground">{ref.source_id}</span>
                          </div>
                        )}
                        {ref.body && (
                          <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2 mt-1 line-clamp-3">
                            {ref.body}
                          </div>
                        )}
                        {ref.source_url && (
                          <a
                            href={ref.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-orange-600 hover:underline mt-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver anuncio original
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              )}
            </Card>
          )}

          {/* 3. Pipeline - Gerenciar funil */}
          {(conversation || contact) && (
            <Card>
              <CardHeader className="pb-2">
                <CollapsibleHeader
                  title={t('contactSidebar.sections.pipeline.title')}
                  description={t('contactSidebar.sections.pipeline.description')}
                  icon={<GitBranch className="h-4 w-4 text-blue-500" />}
                  isOpen={showPipeline}
                  onToggle={() => setShowPipeline(!showPipeline)}
                />
              </CardHeader>

              {showPipeline && (
                <CardContent className="pt-0 px-3 pb-3">
                  {conversation && (
                    <>
                      <div className="max-h-60 overflow-y-auto scrollbar-thin pr-1">
                        <ConversationPipelineItem
                          conversationId={conversation.id}
                          pipelines={conversationPipelines}
                          isLoadingPipelines={isLoadingPipelines}
                          onPipelineUpdated={handlePipelineUpdated}
                        />
                      </div>
                      <div className="pt-4 border-t border-border mt-4">
                        <PipelineManagement
                          conversationId={conversation.id}
                          pipelines={conversationPipelines}
                          onPipelineUpdated={handlePipelineUpdated}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* 3. Macros - OCULTO — habilitar quando pronto */}
          {/* {conversation && (
            <Card>
              <CardHeader className="pb-2">
                <CollapsibleHeader
                  title={t('contactSidebar.sections.macros.title')}
                  description={t('contactSidebar.sections.macros.description')}
                  icon={<Zap className="h-4 w-4 text-orange-500" />}
                  isOpen={showMacros}
                  onToggle={() => setShowMacros(!showMacros)}
                />
              </CardHeader>

              {showMacros && (
                <CardContent className="pt-0 px-3 pb-3">
                  <MacrosList
                    conversationId={String(conversation.id)}
                    onMacroExecuted={onFilterReload}
                  />
                </CardContent>
              )}
            </Card>
          )} */}

          {/* 4. Contact Notes - Notas do contato */}
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleHeader
                title={t('contactSidebar.sections.contactNotes.title')}
                description={t('contactSidebar.sections.contactNotes.description')}
                icon={<FileText className="h-4 w-4 text-orange-500" />}
                count={notes.length}
                isOpen={showContactNotes}
                onToggle={() => setShowContactNotes(!showContactNotes)}
              />
            </CardHeader>

            {showContactNotes && (
              <CardContent className="pt-0 px-3 pb-3 space-y-2">
                {notes.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2 rounded bg-muted/30">
                    {t('contactSidebar.sections.contactNotes.noNotes')}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {notes.map((note: any) => (
                      <div key={note.id} className="text-xs p-2 rounded bg-muted/30 border border-border">
                        <p className="whitespace-pre-wrap break-words">{note.content}</p>
                        {note.created_at && (
                          <p className="text-muted-foreground mt-1">
                            {new Date(note.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <input
                    className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={t('contactSidebar.sections.contactNotes.placeholder') || 'Nova nota...'}
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newNote.trim() && contact?.id) {
                        setIsSavingNote(true);
                        try {
                          const created = await contactsService.createContactNote(String(contact.id), newNote.trim());
                          setNotes(prev => [created, ...prev]);
                          setNewNote('');
                        } catch { /* noop */ } finally {
                          setIsSavingNote(false);
                        }
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={isSavingNote || !newNote.trim()}
                    onClick={async () => {
                      if (!newNote.trim() || !contact?.id) return;
                      setIsSavingNote(true);
                      try {
                        const created = await contactsService.createContactNote(String(contact.id), newNote.trim());
                        setNotes(prev => [created, ...prev]);
                        setNewNote('');
                      } catch { /* noop */ } finally {
                        setIsSavingNote(false);
                      }
                    }}
                  >
                    {isSavingNote ? '...' : '+'}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* 4. Previous Conversations - Conversas anteriores */}
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleHeader
                title={t('contactSidebar.sections.previousConversations.title')}
                description={t('contactSidebar.sections.previousConversations.description')}
                icon={<MessageSquare className="h-4 w-4 text-purple-500" />}
                count={prevConversations.length}
                isOpen={showPreviousConversations}
                onToggle={() => setShowPreviousConversations(!showPreviousConversations)}
              />
            </CardHeader>

            {showPreviousConversations && (
              <CardContent className="pt-0 px-3 pb-3">
                {prevConversations.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2 rounded bg-muted/30">
                    {t('contactSidebar.sections.previousConversations.loading')}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {prevConversations.map((conv: any) => (
                      <div key={conv.id} className="text-xs p-2 rounded bg-muted/30 border border-border flex justify-between items-center">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{conv.inbox_name || `#${conv.id}`}</p>
                          {conv.created_at && (
                            <p className="text-muted-foreground">
                              {new Date(conv.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                        <span className={`ml-2 flex-shrink-0 text-xs px-1.5 py-0.5 rounded capitalize ${
                          conv.status === 'open' ? 'bg-blue-100 text-blue-700' :
                          conv.status === 'resolved' ? 'bg-green-100 text-green-700' :
                          'bg-muted text-muted-foreground'
                        }`}>{conv.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* 5. Conversation Info - Informações da conversa */}
          <Card>
            <CardHeader className="pb-2">
              <CollapsibleHeader
                title={t('contactSidebar.sections.conversationInfo.title')}
                description={t('contactSidebar.sections.conversationInfo.description')}
                icon={<Clock className="h-4 w-4 text-slate-500" />}
                isOpen={showConversationInfo}
                onToggle={() => setShowConversationInfo(!showConversationInfo)}
              />
            </CardHeader>

            {showConversationInfo && (
              <CardContent className="pt-0 px-3 pb-3">
                <div className="space-y-2">
                  {conversation && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t('contactSidebar.sections.conversationInfo.status')}
                        </span>
                        <span className="font-medium capitalize">{conversation.status}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t('contactSidebar.sections.conversationInfo.channel')}
                        </span>
                        <span className="font-medium">{conversation.inbox_name}</span>
                      </div>
                      {conversation.assignee_id && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {t('contactSidebar.sections.conversationInfo.assigned')}
                          </span>
                          <span className="font-medium">
                            {t('contactSidebar.sections.conversationInfo.assignedTo', {
                              id: conversation.assignee_id,
                            })}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          {/* 6. Origem - de onde veio o lead + todos os dados da conversa */}
          {conversation && (
            <Card>
              <CardHeader className="pb-2">
                <CollapsibleHeader
                  title="Origem"
                  description="De onde veio o lead e todos os dados"
                  icon={<Megaphone className="h-4 w-4 text-cyan-500" />}
                  isOpen={showConversationAttributes}
                  onToggle={() => setShowConversationAttributes(!showConversationAttributes)}
                />
              </CardHeader>

              {showConversationAttributes && (
                <CardContent className="pt-0 px-3 pb-3">
                  {(() => {
                    const add = (conversation.additional_attributes || {}) as Record<string, unknown>;
                    const ref = add.ad_referral as Record<string, unknown> | undefined;
                    // Origem principal: anúncio (CTWA) > canal/inbox
                    const originLabel = ref
                      ? `Anúncio ${ref.source_app === 'instagram' ? 'Instagram' : 'Facebook'}`
                      : conversation.inbox_name || 'WhatsApp';
                    // Achata os dados em pares chave/valor legíveis (sem objetos crus).
                    const rows: Array<{ k: string; v: string }> = [];
                    const pushVal = (k: string, v: unknown) => {
                      if (v == null || v === '') return;
                      if (typeof v === 'object') return; // objetos aninhados tratados à parte
                      rows.push({ k, v: String(v) });
                    };
                    Object.entries(add).forEach(([k, v]) => {
                      if (k === 'ad_referral') return;
                      pushVal(k, v);
                    });
                    if (ref) Object.entries(ref).forEach(([k, v]) => pushVal(`anúncio.${k}`, v));
                    const custom = (conversation.custom_attributes || {}) as Record<string, unknown>;
                    Object.entries(custom).forEach(([k, v]) => pushVal(k, v));
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Origem</span>
                          <span className="font-medium text-right max-w-[60%] truncate" title={originLabel}>
                            {originLabel}
                          </span>
                        </div>
                        {Boolean(ref?.source_url) && (
                          <a
                            href={String(ref!.source_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-orange-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver anúncio original
                          </a>
                        )}
                        {rows.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Sem dados adicionais.</div>
                        ) : (
                          rows.map(({ k, v }) => (
                            <div key={k} className="flex justify-between gap-2 text-xs">
                              <span className="text-muted-foreground break-all">{k}</span>
                              <span className="font-medium text-right max-w-[60%] break-all" title={v}>
                                {v}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              )}
            </Card>
          )}

          {/* 7. Contact Custom Attributes - Atributos personalizados do contato */}
          {contact && (
            <Card>
              <CardHeader className="pb-2">
                <CollapsibleHeader
                  title={t('contactSidebar.sections.contactAttributes.title')}
                  description={t('contactSidebar.sections.contactAttributes.description')}
                  icon={<Tag className="h-4 w-4 text-pink-500" />}
                  isOpen={showContactAttributes}
                  onToggle={() => setShowContactAttributes(!showContactAttributes)}
                />
              </CardHeader>

              {showContactAttributes && (
                <CardContent className="pt-0 px-3 pb-3 space-y-4">
                  {/* Tags do lead (mesmas globais do card do kanban) */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Tags</p>
                    <ContactTagsManager
                      contactId={String(contact.id)}
                      conversationId={conversation ? String(conversation.id) : undefined}
                      initialLabels={(contact as { labels?: Array<{ name?: string; title?: string; color?: string }> }).labels}
                      onUpdated={onFilterReload}
                    />
                  </div>
                  <EditableContactCustomAttributes
                    contact={contact}
                    onContactUpdate={onFilterReload}
                  />
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default ContactSidebar;
