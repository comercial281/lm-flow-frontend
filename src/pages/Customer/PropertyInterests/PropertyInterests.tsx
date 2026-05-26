import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label as UILabel,
  Textarea,
  Input,
} from '@evoapi/design-system';
import {
  TrendingUp, Building2, User, ChevronRight, Trophy, XCircle,
  Plus, Search,
} from 'lucide-react';
import {
  propertyInterestsService,
  PropertyInterest,
  PropertyInterestFormData,
  INTEREST_STAGE_LABELS,
  INTEREST_STAGE_COLORS,
} from '@/services/propertyInterests/propertyInterestsService';
import { propertiesService, Property } from '@/services/properties/propertiesService';
import contactsService from '@/services/contacts/contactsService';
import type { Contact } from '@/types/contacts';

const STAGE_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'interested', label: 'Interessados' },
  { key: 'visit_scheduled', label: 'Visita Agendada' },
  { key: 'visited', label: 'Visitados' },
  { key: 'proposal_sent', label: 'Proposta Enviada' },
  { key: 'negotiating', label: 'Em Negociação' },
  { key: 'closed_won', label: 'Ganhos' },
  { key: 'closed_lost', label: 'Perdidos' },
];

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-muted-foreground';
};

export default function PropertyInterests() {
  const navigate = useNavigate();
  const [interests, setInterests] = useState<PropertyInterest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeStage, setActiveStage] = useState('');

  // Close Lost modal
  const [lostTarget, setLostTarget] = useState<PropertyInterest | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [lostLoading, setLostLoading] = useState(false);

  // Create interest modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<PropertyInterestFormData>({ contact_id: '', property_id: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [propertyQuery, setPropertyQuery] = useState('');
  const [propertyResults, setPropertyResults] = useState<Property[]>([]);
  const [showPropDrop, setShowPropDrop] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [showContactDrop, setShowContactDrop] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [propSearchTimer, setPropSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [contactSearchTimer, setContactSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (stage = activeStage) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (stage) params.interest_stage = stage;
      const res = await propertyInterestsService.list(params);
      setInterests(res.data);
      setTotal(res.meta?.total ?? res.data.length);
    } catch {
      toast.error('Erro ao carregar interesses');
    } finally {
      setLoading(false);
    }
  }, [activeStage]);

  useEffect(() => { load(); }, []);

  const switchStage = (stage: string) => {
    setActiveStage(stage);
    load(stage);
  };

  const handleAdvance = async (interest: PropertyInterest) => {
    try {
      const updated = await propertyInterestsService.advance(interest.id);
      setInterests(prev => prev.map(i => i.id === updated.id ? updated : i));
      toast.success(`Avançado para ${INTEREST_STAGE_LABELS[updated.interest_stage]}`);
    } catch {
      toast.error('Erro ao avançar estágio');
    }
  };

  const handleCloseWon = async (interest: PropertyInterest) => {
    try {
      const updated = await propertyInterestsService.closeWon(interest.id);
      setInterests(prev => prev.map(i => i.id === updated.id ? updated : i));
      toast.success('Marcado como Fechado (Ganho)');
    } catch {
      toast.error('Erro ao fechar como ganho');
    }
  };

  const handleCloseLost = async () => {
    if (!lostTarget) return;
    if (!lostReason.trim()) { toast.error('Motivo obrigatório'); return; }
    setLostLoading(true);
    try {
      const updated = await propertyInterestsService.closeLost(lostTarget.id, lostReason);
      setInterests(prev => prev.map(i => i.id === updated.id ? updated : i));
      toast.success('Interesse descartado');
      setLostTarget(null);
      setLostReason('');
    } catch {
      toast.error('Erro ao descartar interesse');
    } finally {
      setLostLoading(false);
    }
  };

  const searchProperties = (q: string) => {
    if (propSearchTimer) clearTimeout(propSearchTimer);
    if (!q.trim()) { setPropertyResults([]); setShowPropDrop(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await propertiesService.list({ q, per_page: 8 });
        setPropertyResults(res.data ?? []);
        setShowPropDrop(true);
      } catch { /* ignore */ }
    }, 300);
    setPropSearchTimer(t);
  };

  const searchContacts = (q: string) => {
    if (contactSearchTimer) clearTimeout(contactSearchTimer);
    if (!q.trim()) { setContactResults([]); setShowContactDrop(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await contactsService.searchContacts({ q, page: 1, per_page: 8 });
        setContactResults(res.data ?? []);
        setShowContactDrop(true);
      } catch { /* ignore */ }
    }, 300);
    setContactSearchTimer(t);
  };

  const openCreate = () => {
    setCreateForm({ contact_id: '', property_id: '' });
    setPropertyQuery('');
    setContactQuery('');
    setSelectedProperty(null);
    setSelectedContact(null);
    setPropertyResults([]);
    setContactResults([]);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!createForm.property_id) { toast.error('Selecione um imóvel'); return; }
    if (!createForm.contact_id) { toast.error('Selecione um contato'); return; }
    setCreateLoading(true);
    try {
      const created = await propertyInterestsService.create(createForm);
      setInterests(prev => [created, ...prev]);
      setTotal(t => t + 1);
      toast.success('Interesse registrado');
      setCreateOpen(false);
    } catch {
      toast.error('Erro ao registrar interesse');
    } finally {
      setCreateLoading(false);
    }
  };

  const isClosed = (stage: string) => stage === 'closed_won' || stage === 'closed_lost';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Interesses
            </h1>
            <p className="text-sm text-muted-foreground">{total} interesse{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Registrar interesse
          </Button>
        </div>

        <div className="flex gap-1 flex-wrap">
          {STAGE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => switchStage(f.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                activeStage === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando interesses...
          </div>
        ) : interests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum interesse encontrado</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar interesse
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {interests.map(interest => (
              <div
                key={interest.id}
                className="flex items-start gap-4 rounded-xl border border-border bg-card p-4"
              >
                {/* Score */}
                <div className="flex-shrink-0 text-center w-12">
                  <div className={`text-xl font-bold ${SCORE_COLOR(interest.match_score)}`}>
                    {interest.match_score}
                  </div>
                  <div className="text-xs text-muted-foreground">match</div>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={`text-xs ${INTEREST_STAGE_COLORS[interest.interest_stage]}`}>
                      {INTEREST_STAGE_LABELS[interest.interest_stage]}
                    </Badge>
                  </div>

                  {interest.property ? (
                    <button
                      className="flex items-center gap-1.5 text-sm font-medium hover:text-primary text-left"
                      onClick={() => navigate('/properties')}
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{interest.property.title}</span>
                      <span className="text-muted-foreground font-normal">·</span>
                      <span className="text-muted-foreground font-normal">{interest.property.display_price}</span>
                    </button>
                  ) : (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Imóvel ID {interest.property_id}
                    </div>
                  )}

                  {interest.contact ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <User className="h-3 w-3 shrink-0" />
                      <span>{interest.contact.name}</span>
                      {interest.contact.phone_number && (
                        <span>· {interest.contact.phone_number}</span>
                      )}
                    </div>
                  ) : null}

                  {interest.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">{interest.notes}</p>
                  )}
                  {interest.lost_reason && (
                    <p className="text-xs text-red-500 mt-1">Motivo: {interest.lost_reason}</p>
                  )}
                </div>

                {/* Actions */}
                {!isClosed(interest.interest_stage) && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Avançar estágio"
                      onClick={() => handleAdvance(interest)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald-600 hover:text-emerald-700"
                      title="Fechar como Ganho"
                      onClick={() => handleCloseWon(interest)}
                    >
                      <Trophy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      title="Descartar"
                      onClick={() => { setLostTarget(interest); setLostReason(''); }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close Lost Modal */}
      <Dialog open={!!lostTarget} onOpenChange={open => { if (!open) setLostTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar interesse</DialogTitle>
            <DialogDescription>
              Informe o motivo pelo qual este interesse foi descartado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <UILabel>Motivo *</UILabel>
            <Textarea
              value={lostReason}
              onChange={e => setLostReason(e.target.value)}
              rows={3}
              placeholder="Ex: lead desistiu, preço acima do orçamento..."
              className="mt-1 resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleCloseLost} disabled={lostLoading}>
              {lostLoading ? 'Salvando...' : 'Descartar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar interesse</DialogTitle>
            <DialogDescription>Vincule um contato a um imóvel</DialogDescription>
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
                  placeholder="Buscar por título ou código..."
                  className="pl-9"
                />
              </div>
              {showPropDrop && propertyResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-44 overflow-y-auto">
                  {propertyResults.map(p => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0 text-sm"
                      onClick={() => {
                        setSelectedProperty(p);
                        setCreateForm(f => ({ ...f, property_id: p.id }));
                        setPropertyQuery(p.title);
                        setShowPropDrop(false);
                      }}
                    >
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.code} · {p.address_city}</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedProperty && (
                <div className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {selectedProperty.code} selecionado
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
                  placeholder="Buscar por nome ou telefone..."
                  className="pl-9"
                />
              </div>
              {showContactDrop && contactResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-44 overflow-y-auto">
                  {contactResults.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0 text-sm"
                      onClick={() => {
                        setSelectedContact(c);
                        setCreateForm(f => ({ ...f, contact_id: String(c.id) }));
                        setContactQuery(c.name);
                        setShowContactDrop(false);
                      }}
                    >
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone_number}</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedContact && (
                <div className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <User className="h-3 w-3" /> {selectedContact.name} selecionado
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <UILabel>Observações (opcional)</UILabel>
              <Textarea
                value={createForm.notes ?? ''}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Preferências, budget, observações..."
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading ? 'Salvando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
