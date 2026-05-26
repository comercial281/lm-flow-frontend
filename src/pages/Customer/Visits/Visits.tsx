import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label as UILabel,
  Textarea,
} from '@evoapi/design-system';
import {
  Plus,
  CalendarClock,
  Building2,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Star,
  Search,
  ChevronDown,
} from 'lucide-react';
import {
  visitsService,
  Visit,
  VisitFormData,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_COLORS,
} from '@/services/visits/visitsService';
import { propertiesService, Property } from '@/services/properties/propertiesService';
import contactsService from '@/services/contacts/contactsService';
import type { Contact } from '@/types/contacts';
import { usersService } from '@/services/users';
import type { User } from '@/types/users';

const FILTER_TABS = [
  { key: '', label: 'Todas' },
  { key: 'scheduled', label: 'Agendadas' },
  { key: 'confirmed', label: 'Confirmadas' },
  { key: 'completed', label: 'Realizadas' },
  { key: 'cancelled', label: 'Canceladas' },
];

const EMPTY_FORM: VisitFormData = {
  property_id: '',
  contact_id: '',
  realtor_id: null,
  scheduled_at: '',
  duration_minutes: 60,
  notes: '',
};

function formatDateTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function groupByDate(visits: Visit[]): Map<string, Visit[]> {
  const map = new Map<string, Visit[]>();
  visits.forEach(v => {
    const date = new Date(v.scheduled_at).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(v);
  });
  return map;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return d.toDateString() === t.toDateString();
}

function isPast(iso: string) {
  return new Date(iso) < new Date();
}

export default function Visits() {
  const [visits, setVisits]         = useState<Visit[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState('');

  const [modalOpen, setModalOpen]   = useState(false);
  const [form, setForm]             = useState<VisitFormData>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);

  const [actionModal, setActionModal] = useState<{ visit: Visit; action: 'complete' | 'cancel' } | null>(null);
  const [rating, setRating]           = useState(0);
  const [feedback, setFeedback]       = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Property + contact search state
  const [propertyQuery, setPropertyQuery] = useState('');
  const [propertyResults, setPropertyResults] = useState<Property[]>([]);
  const [propertySearching, setPropertySearching] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);

  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [contactSearching, setContactSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const [realtorQuery, setRealtorQuery] = useState('');
  const [realtorResults, setRealtorResults] = useState<User[]>([]);
  const [realtorSearching, setRealtorSearching] = useState(false);
  const [selectedRealtor, setSelectedRealtor] = useState<User | null>(null);
  const [showRealtorDropdown, setShowRealtorDropdown] = useState(false);

  const propertyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (status = activeTab) => {
    setLoading(true);
    try {
      const res = await visitsService.list({ status: status || undefined, per_page: 100 });
      setVisits(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch {
      toast.error('Erro ao carregar visitas');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, []);

  const switchTab = (key: string) => {
    setActiveTab(key);
    load(key);
  };

  const searchProperties = (q: string) => {
    if (propertyTimeout.current) clearTimeout(propertyTimeout.current);
    if (!q.trim()) { setPropertyResults([]); setShowPropertyDropdown(false); return; }
    setPropertySearching(true);
    propertyTimeout.current = setTimeout(async () => {
      try {
        const res = await propertiesService.list({ q, per_page: 8 });
        setPropertyResults(res.data ?? []);
        setShowPropertyDropdown(true);
      } catch { setPropertyResults([]); }
      finally { setPropertySearching(false); }
    }, 300);
  };

  const selectProperty = (p: Property) => {
    setSelectedProperty(p);
    setForm(f => ({ ...f, property_id: p.id }));
    setPropertyQuery(p.title);
    setShowPropertyDropdown(false);
  };

  const searchContacts = (q: string) => {
    if (contactTimeout.current) clearTimeout(contactTimeout.current);
    if (!q.trim()) { setContactResults([]); setShowContactDropdown(false); return; }
    setContactSearching(true);
    contactTimeout.current = setTimeout(async () => {
      try {
        const res = await contactsService.searchContacts({ q, page: 1, per_page: 8 });
        setContactResults(res.data ?? []);
        setShowContactDropdown(true);
      } catch { setContactResults([]); }
      finally { setContactSearching(false); }
    }, 300);
  };

  const searchRealtors = (q: string) => {
    if (realtorTimeout.current) clearTimeout(realtorTimeout.current);
    if (!q.trim()) { setRealtorResults([]); setShowRealtorDropdown(false); return; }
    setRealtorSearching(true);
    realtorTimeout.current = setTimeout(async () => {
      try {
        const res = await usersService.getUsers({ q, per_page: 8 });
        setRealtorResults(res.data ?? []);
        setShowRealtorDropdown(true);
      } catch { setRealtorResults([]); }
      finally { setRealtorSearching(false); }
    }, 300);
  };

  const selectRealtor = (u: User) => {
    setSelectedRealtor(u);
    setForm(f => ({ ...f, realtor_id: u.id }));
    setRealtorQuery(u.available_name ?? u.name);
    setShowRealtorDropdown(false);
  };

  const selectContact = (c: Contact) => {
    setSelectedContact(c);
    setForm(f => ({ ...f, contact_id: String(c.id) }));
    setContactQuery(c.name);
    setShowContactDropdown(false);
  };

  const openScheduleModal = () => {
    setForm(EMPTY_FORM);
    setPropertyQuery('');
    setContactQuery('');
    setRealtorQuery('');
    setSelectedProperty(null);
    setSelectedContact(null);
    setSelectedRealtor(null);
    setPropertyResults([]);
    setContactResults([]);
    setRealtorResults([]);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.property_id.trim()) { toast.error('Selecione um imóvel'); return; }
    if (!form.contact_id.trim())  { toast.error('Selecione um contato'); return; }
    if (!form.scheduled_at)       { toast.error('Data/hora é obrigatória'); return; }
    setSaving(true);
    try {
      const created = await visitsService.create(form);
      setVisits(prev => [created, ...prev]);
      setTotal(t => t + 1);
      toast.success('Visita agendada');
      setModalOpen(false);
      setForm(EMPTY_FORM);
    } catch {
      toast.error('Erro ao agendar visita');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (visit: Visit) => {
    try {
      const updated = await visitsService.confirm(visit.id);
      setVisits(prev => prev.map(v => v.id === updated.id ? updated : v));
      toast.success('Visita confirmada');
    } catch {
      toast.error('Erro ao confirmar visita');
    }
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      let updated: Visit;
      if (actionModal.action === 'complete') {
        updated = await visitsService.complete(actionModal.visit.id, rating || undefined, feedback || undefined);
        toast.success('Visita marcada como realizada');
      } else {
        updated = await visitsService.cancel(actionModal.visit.id, cancelReason || undefined);
        toast.success('Visita cancelada');
      }
      setVisits(prev => prev.map(v => v.id === updated.id ? updated : v));
      setActionModal(null);
      setRating(0);
      setFeedback('');
      setCancelReason('');
    } catch {
      toast.error('Erro ao executar ação');
    } finally {
      setActionLoading(false);
    }
  };

  const grouped = groupByDate(visits);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClock className="h-6 w-6 text-primary" />
              Agenda de Visitas
            </h1>
            <p className="text-sm text-muted-foreground">{total} visita{total !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={openScheduleModal}>
            <Plus className="h-4 w-4 mr-2" />
            Agendar visita
          </Button>
        </div>

        {/* Tab filters */}
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando visitas...
          </div>
        ) : visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarClock className="h-12 w-12 mb-3" />
            <p className="text-sm font-medium">Nenhuma visita encontrada</p>
            <Button className="mt-4" onClick={openScheduleModal}>
              <Plus className="h-4 w-4 mr-2" />
              Agendar primeira visita
            </Button>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {Array.from(grouped.entries()).map(([date, dayVisits]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`text-sm font-semibold capitalize ${
                    dayVisits.some(v => isToday(v.scheduled_at)) ? 'text-primary' : 'text-foreground'
                  }`}>
                    {date}
                  </div>
                  {dayVisits.some(v => isToday(v.scheduled_at)) && (
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">Hoje</Badge>
                  )}
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-3">
                  {dayVisits.map(visit => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      onConfirm={handleConfirm}
                      onComplete={() => setActionModal({ visit, action: 'complete' })}
                      onCancel={() => setActionModal({ visit, action: 'cancel' })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agendar visita</DialogTitle>
            <DialogDescription>Preencha os dados da visita ao imóvel</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Property search */}
            <div className="relative">
              <UILabel>Imóvel *</UILabel>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={propertyQuery}
                  onChange={e => { setPropertyQuery(e.target.value); searchProperties(e.target.value); }}
                  onFocus={() => propertyResults.length > 0 && setShowPropertyDropdown(true)}
                  placeholder="Buscar por título, código..."
                  className="pl-9"
                />
                {propertySearching && (
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                )}
              </div>
              {showPropertyDropdown && propertyResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {propertyResults.map(p => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0 text-sm"
                      onClick={() => selectProperty(p)}
                    >
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.code} · {p.address_city}</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedProperty && (
                <div className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {selectedProperty.code} selecionado
                </div>
              )}
            </div>

            {/* Contact search */}
            <div className="relative">
              <UILabel>Contato *</UILabel>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={contactQuery}
                  onChange={e => { setContactQuery(e.target.value); searchContacts(e.target.value); }}
                  onFocus={() => contactResults.length > 0 && setShowContactDropdown(true)}
                  placeholder="Buscar por nome ou telefone..."
                  className="pl-9"
                />
              </div>
              {showContactDropdown && contactResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {contactResults.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0 text-sm"
                      onClick={() => selectContact(c)}
                    >
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone_number}</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedContact && (
                <div className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {selectedContact.name} selecionado
                </div>
              )}
            </div>

            {/* Realtor search */}
            <div className="relative">
              <UILabel>Corretor responsável (opcional)</UILabel>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={realtorQuery}
                  onChange={e => { setRealtorQuery(e.target.value); searchRealtors(e.target.value); }}
                  onFocus={() => realtorResults.length > 0 && setShowRealtorDropdown(true)}
                  placeholder="Buscar por nome..."
                  className="pl-9"
                />
                {realtorSearching && (
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                )}
              </div>
              {showRealtorDropdown && realtorResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {realtorResults.map(u => (
                    <button
                      key={u.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0 text-sm"
                      onClick={() => selectRealtor(u)}
                    >
                      <div className="font-medium truncate">{u.available_name ?? u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedRealtor && (
                <div className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {selectedRealtor.available_name ?? selectedRealtor.name} selecionado
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <UILabel>Data e hora *</UILabel>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <UILabel>Duração (min)</UILabel>
                <Input
                  type="number"
                  value={form.duration_minutes ?? ''}
                  onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || undefined }))}
                  min={15}
                  step={15}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <UILabel>Observações</UILabel>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Detalhes da visita..."
                className="mt-1 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Agendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete / Cancel action modal */}
      <Dialog open={!!actionModal} onOpenChange={() => setActionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionModal?.action === 'complete' ? 'Marcar visita como realizada' : 'Cancelar visita'}
            </DialogTitle>
          </DialogHeader>
          {actionModal?.action === 'complete' ? (
            <div className="space-y-4 py-2">
              <div>
                <UILabel>Avaliação (1-5)</UILabel>
                <div className="flex gap-1 mt-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setRating(n)}>
                      <Star className={`h-6 w-6 ${n <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <UILabel>Feedback do cliente</UILabel>
                <Textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="Como foi a visita? Interesse do cliente?"
                  className="mt-1 resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="py-2">
              <UILabel>Motivo do cancelamento</UILabel>
              <Textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Opcional"
                className="mt-1 resize-none"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Voltar</Button>
            <Button
              variant={actionModal?.action === 'cancel' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading ? 'Salvando...' : actionModal?.action === 'complete' ? 'Confirmar realização' : 'Cancelar visita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VisitCard({
  visit,
  onConfirm,
  onComplete,
  onCancel,
}: {
  visit: Visit;
  onConfirm: (v: Visit) => void;
  onComplete: (v: Visit) => void;
  onCancel: (v: Visit) => void;
}) {
  const isPastVisit = isPast(visit.scheduled_at);
  const isActive = ['scheduled', 'confirmed', 'in_progress'].includes(visit.status);

  return (
    <div className={`flex gap-4 p-4 rounded-xl border border-border bg-card ${
      isPastVisit && isActive ? 'border-amber-300 dark:border-amber-700' : ''
    }`}>
      {/* Time column */}
      <div className="flex-shrink-0 w-16 text-center">
        <div className="text-lg font-bold text-foreground">
          {new Date(visit.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        {visit.duration_minutes && (
          <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            {visit.duration_minutes}min
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium ${VISIT_STATUS_COLORS[visit.status] ?? ''}`}>
              {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
            </span>
            {isPastVisit && isActive && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-medium">Atrasada</span>
            )}
          </div>
          {visit.rating != null && (
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(n => (
                <Star key={n} className={`h-3.5 w-3.5 ${n <= (visit.rating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`} />
              ))}
            </div>
          )}
        </div>

        {visit.property && (
          <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="truncate">{visit.property.title}</span>
            <span className="text-xs text-muted-foreground">· {visit.property.code}</span>
          </div>
        )}

        {visit.property && (visit.property.address_neighborhood || visit.property.address_city) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {[visit.property.address_neighborhood, visit.property.address_city].filter(Boolean).join(', ')}
          </div>
        )}

        {visit.contact && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <User className="h-3 w-3 flex-shrink-0" />
            <span>{visit.contact.name}</span>
            {visit.contact.phone_number && (
              <>
                <span>·</span>
                <Phone className="h-3 w-3" />
                <span>{visit.contact.phone_number}</span>
              </>
            )}
          </div>
        )}

        {visit.realtor && (
          <div className="text-xs text-muted-foreground">Corretor: {visit.realtor.name}</div>
        )}

        {visit.notes && (
          <p className="text-xs text-muted-foreground mt-1 italic">{visit.notes}</p>
        )}

        {/* Actions */}
        {isActive && (
          <div className="flex gap-2 mt-3">
            {visit.status === 'scheduled' && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onConfirm(visit)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Confirmar
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800"
              onClick={() => onComplete(visit)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Realizada
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800"
              onClick={() => onCancel(visit)}>
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function isPast(iso: string) {
  return new Date(iso) < new Date();
}
