import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Avatar,
  AvatarFallback,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ScrollArea,
  Input,
} from '@evoapi/design-system';
import ContactStatusBadge from './ContactStatusBadge';
import ContactTypeBadge from './ContactTypeBadge';
import ContactMergeSelectorModal from './ContactMergeSelectorModal';
import ContactMergeModal from './ContactMergeModal';
import { contactsService } from '@/services/contacts/contactsService';
import {
  Edit,
  MessageSquare,
  Phone,
  Mail,
  User,
  History,
  StickyNote,
  Settings,
  Building2,
  Users,
  ExternalLink,
  Search,
  // CalendarClock,
  GitBranch,
  Merge,
  Plus,
  TrendingUp,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';
// import { ScheduledActionsList } from '@/components/scheduledActions';
import { Contact } from '@/types/contacts';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import ContactPipelineItem from '@/components/pipelines/ContactPipelineItem';
import { toast } from 'sonner';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  propertyInterestsService,
  PropertyInterest,
  INTEREST_STAGE_LABELS,
  INTEREST_STAGE_COLORS,
} from '@/services/propertyInterests/propertyInterestsService';

interface ContactDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onEdit: (contact: Contact) => void;
  onStartConversation: (contact: Contact) => void;
  onNavigateToContact?: (contactId: string) => void;
  onContactUpdated?: () => void;
}

export default function ContactDetails({
  open,
  onOpenChange,
  contact,
  onEdit,
  onStartConversation,
  onNavigateToContact,
  onContactUpdated,
}: ContactDetailsProps) {
  const { t } = useLanguage('contacts');
  const { can } = useUserPermissions();
  const [activeTab, setActiveTab] = useState('pipeline'); // Changed from 'scheduled-actions' to 'pipeline' (scheduled actions disabled)
  const [companiesSearch, setCompaniesSearch] = useState('');
  const [personsSearch, setPersonsSearch] = useState('');
  const [mergeSelectorOpen, setMergeSelectorOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [contactsToMerge, setContactsToMerge] = useState<Contact[]>([]);
  const [merging, setMerging] = useState(false);
  const [propertyInterests, setPropertyInterests] = useState<PropertyInterest[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [newInterestPropertyId, setNewInterestPropertyId] = useState('');
  const [addingInterest, setAddingInterest] = useState(false);
  const [qualifyResult, setQualifyResult] = useState<{ status: string; score: number; reasoning: string; insights?: string[] } | null>(null);
  const [qualifyLoading, setQualifyLoading] = useState(false);
  const [qualifyModalOpen, setQualifyModalOpen] = useState(false);

  const loadPropertyInterests = useCallback(async (contactId: string) => {
    setInterestsLoading(true);
    try {
      const res = await propertyInterestsService.listByContact(contactId);
      setPropertyInterests(res.data);
    } catch {
      setPropertyInterests([]);
    } finally {
      setInterestsLoading(false);
    }
  }, []);

  // Reset tab when contact changes
  useEffect(() => {
    if (contact?.id) {
      setActiveTab('pipeline'); // Changed from 'scheduled-actions' to 'pipeline' (scheduled actions disabled)
      setCompaniesSearch('');
      setPersonsSearch('');
    }
  }, [contact?.id]);

  useEffect(() => {
    if (contact?.id && activeTab === 'properties') {
      loadPropertyInterests(contact.id);
    }
  }, [contact?.id, activeTab, loadPropertyInterests]);

  const handleAddInterest = async () => {
    if (!contact || !newInterestPropertyId.trim()) return;
    setAddingInterest(true);
    try {
      await propertyInterestsService.create({
        contact_id: contact.id,
        property_id: newInterestPropertyId.trim(),
        interest_stage: 'interested',
      });
      setNewInterestPropertyId('');
      loadPropertyInterests(contact.id);
    } catch {
      toast.error('Erro ao adicionar interesse');
    } finally {
      setAddingInterest(false);
    }
  };

  const handleAdvanceInterest = async (id: string) => {
    try {
      await propertyInterestsService.advance(id);
      if (contact) loadPropertyInterests(contact.id);
    } catch {
      toast.error('Não foi possível avançar o estágio');
    }
  };

  const handleRemoveInterest = async (id: string) => {
    try {
      await propertyInterestsService.delete(id);
      if (contact) loadPropertyInterests(contact.id);
    } catch {
      toast.error('Erro ao remover interesse');
    }
  };

  // Filter companies by search - MUST be before early return
  const filteredCompanies = useMemo(() => {
    if (!contact || contact.type !== 'person' || !contact.companies) return [];
    if (!companiesSearch) return contact.companies;
    return contact.companies.filter(company =>
      company.name.toLowerCase().includes(companiesSearch.toLowerCase()),
    );
  }, [contact, companiesSearch]);

  // Filter persons by search - MUST be before early return
  const filteredPersons = useMemo(() => {
    if (!contact || contact.type !== 'company' || !contact.persons) return [];
    if (!personsSearch) return contact.persons;
    return contact.persons.filter(person =>
      person.name.toLowerCase().includes(personsSearch.toLowerCase()),
    );
  }, [contact, personsSearch]);

  // Early return AFTER all hooks
  if (!contact) return null;

  const isPerson = contact.type === 'person';
  const isCompany = contact.type === 'company';
  const hasCompanies = isPerson && contact.companies && contact.companies.length > 0;
  const hasPersons = isCompany && contact.persons && contact.persons.length > 0;

  const getUserInitials = (name: string) => {
    if (!name) return t('details.na');
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCompanyClick = (companyId: string) => {
    if (onNavigateToContact) {
      onOpenChange(false);
      setTimeout(() => {
        onNavigateToContact(companyId);
      }, 100);
    }
  };

  const handleMergeClick = () => {
    if (!can('contacts', 'update')) {
      toast.error(t('messages.mergeError'));
      return;
    }
    setMergeSelectorOpen(true);
  };

  const handleContactSelected = (selectedContact: Contact) => {
    if (contact) {
      setContactsToMerge([contact, selectedContact]);
      setMergeModalOpen(true);
    }
  };

  const handleConfirmMerge = async (parentContactId: string, childContactId: string) => {
    setMerging(true);
    try {
      await contactsService.mergeContacts({
        base_contact_id: parentContactId,
        mergee_contact_id: childContactId,
      });

      toast.success(t('messages.mergeSuccess'));
      setMergeModalOpen(false);
      setMergeSelectorOpen(false);
      setContactsToMerge([]);
      onOpenChange(false);

      // Notify parent to refresh contacts list
      if (onContactUpdated) {
        onContactUpdated();
      }
    } catch (error) {
      console.error('Error merging contacts:', error);
      toast.error(t('messages.mergeError'));
    } finally {
      setMerging(false);
    }
  };

  const handleQualify = async () => {
    if (!contact) return;
    setQualifyLoading(true);
    setQualifyModalOpen(true);
    setQualifyResult(null);
    try {
      const result = await contactsService.qualifyLead(contact.id);
      setQualifyResult(result);
    } catch {
      toast.error('Erro ao qualificar lead via IA');
      setQualifyModalOpen(false);
    } finally {
      setQualifyLoading(false);
    }
  };

  // Dynamic tabs based on contact type
  const tabs = [
    ...(hasCompanies
      ? [{ value: 'companies', icon: Building2, label: t('details.tabs.companies') }]
      : []),
    ...(hasPersons ? [{ value: 'persons', icon: Users, label: t('details.tabs.persons') }] : []),
    // Scheduled Actions temporarily disabled - feature is in development
    // { value: 'scheduled-actions', icon: CalendarClock, label: t('scheduledActions.label') },
    { value: 'pipeline', icon: GitBranch, label: t('details.tabs.pipeline') },
    { value: 'properties', icon: Building2, label: 'Imóveis' },
    { value: 'history', icon: History, label: t('details.tabs.history') },
    { value: 'notes', icon: StickyNote, label: t('details.tabs.notes') },
    { value: 'attributes', icon: Settings, label: t('details.tabs.attributes') },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[75vw] !w-[75vw] max-h-[90vh] p-0 gap-0 flex flex-col"
        style={{ maxWidth: '75vw', width: '75vw' }}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{t('details.title')}</DialogTitle>
        </DialogHeader>

        {/* Contact Header - Fixed */}
        <div className="flex items-start gap-4 px-6 py-4 border-b shrink-0">
          <Avatar className="h-20 w-20 shrink-0">
            {contact.avatar_url || contact.thumbnail ? (
              <img
                src={contact.avatar_url || contact.thumbnail}
                alt={contact.name}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <AvatarFallback className="text-lg">{getUserInitials(contact.name)}</AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 shrink-0 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStartConversation(contact)}
                disabled={contact.blocked}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {t('details.actions.startConversation')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(contact)}>
                <Edit className="h-4 w-4 mr-2" />
                {t('details.actions.edit')}
              </Button>
              {can('contacts', 'update') && (
                <Button variant="outline" size="sm" onClick={handleMergeClick}>
                  <Merge className="h-4 w-4 mr-2" />
                  {t('header.mergeContacts')}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleQualify} disabled={qualifyLoading}>
                <Sparkles className="h-4 w-4 mr-2" />
                {qualifyLoading ? 'Qualificando...' : 'Qualificar IA'}
              </Button>
            </div>
            <div className="flex items-start gap-3 mb-2">
              <ContactTypeBadge type={contact.type || 'person'} />
            </div>
            <div className="text-sm text-muted-foreground mb-3 gap-2">
              {contact.name && (
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <User className="h-4 w-4" />
                  <span className="truncate">{contact.name}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              {contact.phone_number && (
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <Phone className="h-4 w-4" />
                  <span>{contact.phone_number}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ContactStatusBadge blocked={contact.blocked} />
              {contact.conversations_count !== undefined && (
                <Badge variant="secondary">
                  {contact.conversations_count} {t('details.conversations')}
                </Badge>
              )}
              {hasCompanies && (
                <Badge variant="outline" className="gap-1">
                  <Building2 className="h-3 w-3" />
                  {contact.companies!.length}{' '}
                  {contact.companies!.length === 1 ? t('details.company') : t('details.companies')}
                </Badge>
              )}
              {hasPersons && (
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {contact.persons_count}{' '}
                  {contact.persons_count === 1 ? t('details.person') : t('details.persons')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Tabs - Scrollable content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList
            className="shrink-0 mx-6 mt-4 mb-0 grid"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
          >
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6">
              {/* Companies Tab (for person contacts) */}
              {hasCompanies && (
                <TabsContent value="companies" className="space-y-4 py-6 mt-0">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {t('details.sections.linkedCompanies')}
                    </h3>

                    {/* Search Input */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={companiesSearch}
                        onChange={e => setCompaniesSearch(e.target.value)}
                        placeholder={t('details.searchCompanies')}
                        className="pl-10"
                      />
                    </div>

                    {/* Companies List with Scroll */}
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3 pr-3">
                        {filteredCompanies.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground py-8">
                            {companiesSearch
                              ? t('details.noCompaniesFound')
                              : t('details.noCompanies')}
                          </div>
                        ) : (
                          filteredCompanies.map(company => (
                            <div
                              key={company.id}
                              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                              onClick={() => handleCompanyClick(company.id)}
                            >
                              <ContactAvatar
                                contact={company}
                                size="md"
                                showColoredFallback={true}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate flex items-center gap-2">
                                  {company.name}
                                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  {company.email && <div className="truncate">{company.email}</div>}
                                  {company.phone_number && <div>{company.phone_number}</div>}
                                </div>
                              </div>
                              <ContactTypeBadge type="company" />
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              )}

              {/* Persons Tab (for company contacts) */}
              {hasPersons && (
                <TabsContent value="persons" className="space-y-4 py-6 mt-0">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {t('details.sections.linkedPersons')}
                    </h3>

                    {/* Search Input */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={personsSearch}
                        onChange={e => setPersonsSearch(e.target.value)}
                        placeholder={t('details.searchPersons')}
                        className="pl-10"
                      />
                    </div>

                    {/* Persons List with Scroll */}
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3 pr-3">
                        {filteredPersons.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground py-8">
                            {personsSearch ? t('details.noPersonsFound') : t('details.noPersons')}
                          </div>
                        ) : (
                          filteredPersons.map(person => (
                            <div
                              key={person.id}
                              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                              onClick={() => handleCompanyClick(person.id)}
                            >
                              <ContactAvatar
                                contact={person}
                                size="md"
                                showColoredFallback={true}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate flex items-center gap-2">
                                  {person.name}
                                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  {person.email && <div className="truncate">{person.email}</div>}
                                  {person.phone_number && <div>{person.phone_number}</div>}
                                </div>
                              </div>
                              <ContactTypeBadge type="person" />
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              )}

              {/* Scheduled Actions tab temporarily disabled - feature is in development */}
              {/* <TabsContent value="scheduled-actions" className="py-6 mt-0">
                {contact && (
                  <ScheduledActionsList
                    contactId={contact.id}
                  />
                )}
              </TabsContent> */}

              <TabsContent value="history" className="py-6 mt-0">
                <div className="text-center text-muted-foreground py-12">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('details.notImplemented.history')}</p>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="py-6 mt-0">
                <div className="text-center text-muted-foreground py-12">
                  <StickyNote className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('details.notImplemented.notes')}</p>
                </div>
              </TabsContent>

              <TabsContent value="pipeline" className="py-6 mt-0">
                <ContactPipelineItem
                  contactId={contact.id}
                />
              </TabsContent>

              {/* Property Interests Tab */}
              <TabsContent value="properties" className="py-6 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Imóveis de Interesse
                    </h3>
                    <Badge variant="secondary">{propertyInterests.length} imóveis</Badge>
                  </div>

                  {/* Add interest */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="ID do imóvel (UUID)"
                      value={newInterestPropertyId}
                      onChange={e => setNewInterestPropertyId(e.target.value)}
                      className="flex-1"
                      onKeyDown={e => e.key === 'Enter' && handleAddInterest()}
                    />
                    <Button size="sm" onClick={handleAddInterest} disabled={addingInterest || !newInterestPropertyId.trim()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {/* List */}
                  {interestsLoading ? (
                    <div className="text-center text-muted-foreground py-8 text-sm">Carregando...</div>
                  ) : propertyInterests.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">
                      <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Nenhum imóvel vinculado</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {propertyInterests.map(pi => {
                        const stageColor = INTEREST_STAGE_COLORS[pi.interest_stage] ?? '';
                        const stageLabel = INTEREST_STAGE_LABELS[pi.interest_stage] ?? pi.interest_stage;
                        const isClosed = pi.interest_stage === 'closed_won' || pi.interest_stage === 'closed_lost';
                        return (
                          <div key={pi.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-sm truncate">
                                  {pi.property?.title ?? pi.property_id.slice(0, 8)}
                                </span>
                                {pi.property?.code && (
                                  <span className="text-xs text-muted-foreground">{pi.property.code}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={`text-xs ${stageColor}`}>{stageLabel}</Badge>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <TrendingUp className="h-3 w-3" />
                                  {pi.match_score}% match
                                </div>
                                {pi.property?.display_price && (
                                  <span className="text-xs text-muted-foreground">{pi.property.display_price}</span>
                                )}
                              </div>
                              {pi.property?.neighborhood && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {pi.property.neighborhood}{pi.property.city && `, ${pi.property.city}`}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!isClosed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleAdvanceInterest(pi.id)}
                                  title="Avançar estágio"
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveInterest(pi.id)}
                                title="Remover interesse"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="attributes" className="py-6 mt-0">
                <div className="text-center text-muted-foreground py-12">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('details.notImplemented.attributes')}</p>
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>

      {/* Merge Selector Modal */}
      {contact && (
        <ContactMergeSelectorModal
          open={mergeSelectorOpen}
          onOpenChange={setMergeSelectorOpen}
          currentContact={contact}
          onContactSelected={handleContactSelected}
        />
      )}

      {/* Merge Confirmation Modal */}
      <ContactMergeModal
        open={mergeModalOpen}
        onOpenChange={setMergeModalOpen}
        contacts={contactsToMerge}
        onConfirm={handleConfirmMerge}
        loading={merging}
      />

      {/* AI Qualify Result Modal */}
      <Dialog open={qualifyModalOpen} onOpenChange={setQualifyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              Qualificação IA — {contact?.name}
            </DialogTitle>
          </DialogHeader>
          {qualifyLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
              <Sparkles className="h-8 w-8 animate-pulse text-violet-400" />
              <p className="text-sm">Analisando perfil do lead...</p>
            </div>
          ) : qualifyResult ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${
                    qualifyResult.score >= 70 ? 'text-emerald-500' :
                    qualifyResult.score >= 40 ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {qualifyResult.score}
                  </div>
                  <div className="text-xs text-muted-foreground">score</div>
                </div>
                <div>
                  <Badge className={
                    qualifyResult.status === 'qualified' ? 'bg-emerald-100 text-emerald-700' :
                    qualifyResult.status === 'warm' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }>
                    {qualifyResult.status === 'qualified' ? 'Qualificado' :
                     qualifyResult.status === 'warm' ? 'Morno' :
                     qualifyResult.status === 'cold' ? 'Frio' : qualifyResult.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Raciocínio</p>
                <p className="text-sm leading-relaxed">{qualifyResult.reasoning}</p>
              </div>
              {qualifyResult.insights && qualifyResult.insights.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Insights</p>
                  <ul className="space-y-1">
                    {qualifyResult.insights.map((insight, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-violet-500 mt-0.5">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualifyModalOpen(false)}>Fechar</Button>
            {!qualifyLoading && (
              <Button variant="outline" onClick={handleQualify}>
                <Sparkles className="h-4 w-4 mr-2" />
                Requalificar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
