import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/ds';
import ContactStatusBadge from './ContactStatusBadge';
import ContactTypeBadge from './ContactTypeBadge';
import ContactConversationTab from './ContactConversationTab';
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
  TrendingUp,
  X,
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
import { propertiesService, type Property } from '@/services/properties/propertiesService';

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
  const [addingInterest, setAddingInterest] = useState(false);
  // Busca de imóvel por código/título pra adicionar interesse (em vez de colar UUID).
  const [propSearch, setPropSearch] = useState('');
  const [propResults, setPropResults] = useState<Property[]>([]);
  const [searchingProps, setSearchingProps] = useState(false);

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

  // Busca imóveis por código/título (debounce) pra adicionar como interesse.
  useEffect(() => {
    const q = propSearch.trim();
    if (q.length < 2) { setPropResults([]); setSearchingProps(false); return; }
    setSearchingProps(true);
    const t = setTimeout(async () => {
      try {
        const res = await propertiesService.list({ q, per_page: 8 });
        setPropResults(res.data ?? []);
      } catch {
        setPropResults([]);
      } finally {
        setSearchingProps(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [propSearch]);

  const addInterestForProperty = async (propertyId: string) => {
    if (!contact || !propertyId) return;
    if (propertyInterests.some(pi => pi.property_id === propertyId)) {
      toast.info('Esse imóvel já está nos interesses');
      setPropSearch(''); setPropResults([]);
      return;
    }
    setAddingInterest(true);
    try {
      await propertyInterestsService.create({
        contact_id: contact.id,
        property_id: propertyId,
        interest_stage: 'interested',
      });
      setPropSearch(''); setPropResults([]);
      loadPropertyInterests(contact.id);
      toast.success('Imóvel adicionado aos interesses');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao adicionar interesse'));
    } finally {
      setAddingInterest(false);
    }
  };

  const handleChangeInterestStage = async (id: string, stage: string) => {
    try {
      await propertyInterestsService.update(id, { interest_stage: stage });
      if (contact) loadPropertyInterests(contact.id);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não foi possível mudar o estágio'));
    }
  };

  const handleRemoveInterest = async (id: string) => {
    try {
      await propertyInterestsService.delete(id);
      if (contact) loadPropertyInterests(contact.id);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao remover interesse'));
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


  // Dynamic tabs based on contact type
  const tabs = [
    ...(hasCompanies
      ? [{ value: 'companies', icon: Building2, label: t('details.tabs.companies') }]
      : []),
    ...(hasPersons ? [{ value: 'persons', icon: Users, label: t('details.tabs.persons') }] : []),
    // Scheduled Actions temporarily disabled - feature is in development
    // { value: 'scheduled-actions', icon: CalendarClock, label: t('scheduledActions.label') },
    { value: 'conversation', icon: MessageSquare, label: 'Conversa' },
    { value: 'pipeline', icon: GitBranch, label: t('details.tabs.pipeline') },
    { value: 'properties', icon: Building2, label: 'Imóveis' },
    { value: 'history', icon: History, label: t('details.tabs.history') },
    { value: 'notes', icon: StickyNote, label: t('details.tabs.notes') },
    { value: 'attributes', icon: Settings, label: t('details.tabs.attributes') },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[95vw] !max-w-[95vw] sm:!w-[75vw] sm:!max-w-[75vw] max-h-[90vh] p-0 gap-0 flex flex-col"
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
          <TabsList className="shrink-0 mx-6 mt-4 mb-0 flex overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2 flex-1 min-w-fit whitespace-nowrap">
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

              <TabsContent value="conversation" className="py-6 mt-0">
                <ContactConversationTab contactId={contact.id} />
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

                  {/* Add interest — busca por código/título (sem UUID). */}
                  <div className="relative">
                    <Input
                      placeholder="Buscar imóvel por código (IM0001) ou título…"
                      value={propSearch}
                      onChange={e => setPropSearch(e.target.value)}
                      className="w-full"
                    />
                    {propSearch.trim().length >= 2 && (
                      <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-64 overflow-auto">
                        {searchingProps ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Buscando…</div>
                        ) : propResults.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum imóvel encontrado</div>
                        ) : (
                          propResults.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              disabled={addingInterest}
                              onClick={() => addInterestForProperty(p.id)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                            >
                              <span className="min-w-0 truncate">
                                <span className="font-medium">{p.code}</span>
                                <span className="text-muted-foreground"> · {p.title}</span>
                              </span>
                              {p.display_price && (
                                <span className="shrink-0 text-xs text-muted-foreground">{p.display_price}</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
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
                                {/* Status do interesse NESTE imóvel — dropdown pra mudar direto.
                                    Um lead pode ter vários imóveis, cada um com seu status. */}
                                <select
                                  value={pi.interest_stage}
                                  onChange={e => handleChangeInterestStage(pi.id, e.target.value)}
                                  className={`text-xs rounded-md border border-input px-2 py-1 font-medium ${stageColor}`}
                                  title="Status do interesse neste imóvel"
                                >
                                  {Object.entries(INTEREST_STAGE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
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

    </Dialog>
  );
}
