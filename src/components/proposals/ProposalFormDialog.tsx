// Janela de criar/editar proposta. Saiu de dentro da tela de Propostas para
// abrir também no card do lead (aba Visitas e propostas), já com o lead e o
// imóvel preenchidos — sem o corretor sair do card para registrar.
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Building2, RefreshCw } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/ds';
import { proposalsService, type Proposal, type ProposalFormData } from '@/services/proposals/proposalsService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { LeadCombobox } from '@/components/visits/LeadCombobox';
import { Seletor } from '@/components/base/Seletor';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { OpenCardOfContact } from '@/types/analytics';
import type { LeadPickerItem } from '@/services/visits/visitsService';
import { apiErrorMessage } from '@/utils/apiHelpers';

interface ProposalFormState {
  property_id: string;
  contact_id: string;
  proposal_type: 'purchase' | 'rent';
  offered_value: string;
  down_payment: string;
  installments: string;
  payment_method: string;
  conditions: string;
}

const EMPTY_FORM: ProposalFormState = {
  property_id: '',
  contact_id: '',
  proposal_type: 'purchase',
  offered_value: '',
  down_payment: '',
  installments: '',
  payment_method: '',
  conditions: '',
};

export type ImovelDaProposta = { id: string; title?: string | null; code?: string | null };

interface ProposalFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Editar esta proposta. Sem ela, cria um rascunho novo. */
  proposta?: Proposal | null;
  /** Lead já escolhido ao criar (card do lead). */
  leadInicial?: LeadPickerItem | null;
  /** Imóvel sugerido ao criar (o primeiro imóvel de interesse do lead). */
  imovelInicial?: ImovelDaProposta | null;
  /** Card do funil de onde a proposta foi registrada (card do lead). Só vale ao criar. */
  pipelineItemId?: string | null;
  onSaved: () => void;
}

export default function ProposalFormDialog({
  open,
  onOpenChange,
  proposta,
  leadInicial,
  imovelInicial,
  pipelineItemId,
  onSaved,
}: ProposalFormDialogProps) {
  const [form, setForm] = useState<ProposalFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [propertyQuery, setPropertyQuery] = useState('');
  const [propertyResults, setPropertyResults] = useState<Property[]>([]);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [propertySearching, setPropertySearching] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<ImovelDaProposta | null>(null);
  const propertyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const propertyWrapperRef = useRef<HTMLDivElement | null>(null);

  const [selectedLead, setSelectedLead] = useState<LeadPickerItem | null>(null);

  // Pela tela Propostas (sem o card), a proposta também fica ligada a um card
  // (ajuste de 08/10): com mais de um card aberto, pergunta qual; com um, liga
  // sozinho. null = não se aplica (editando, ou registrada pelo card).
  const [cardsAbertos, setCardsAbertos] = useState<OpenCardOfContact[] | null>(null);
  const [cardEscolhido, setCardEscolhido] = useState('');
  const perguntaAtendimento = (cardsAbertos?.length ?? 0) > 1;

  // Valores iniciais lidos só no instante em que abre: o pai recria esses
  // objetos a cada render, e o formulário não pode recomeçar no meio da digitação.
  const iniciais = useRef({ proposta, leadInicial, imovelInicial });
  iniciais.current = { proposta, leadInicial, imovelInicial };

  useEffect(() => {
    if (!open) return;
    const { proposta: p, leadInicial: lead, imovelInicial: imovel } = iniciais.current;
    if (p) {
      setForm({
        property_id: p.property_id,
        contact_id: p.contact_id,
        proposal_type: p.proposal_type,
        offered_value: p.offered_value?.toString() ?? '',
        down_payment: p.down_payment?.toString() ?? '',
        installments: p.installments?.toString() ?? '',
        payment_method: p.payment_method ?? '',
        conditions: p.conditions ?? '',
      });
      setSelectedProperty(p.property ? { id: p.property.id, title: p.property.title, code: p.property.code } : null);
      setSelectedLead(p.contact ? ({ id: p.contact.id, name: p.contact.name } as LeadPickerItem) : null);
      setPropertyQuery(p.property?.title ?? '');
    } else {
      setForm({ ...EMPTY_FORM, contact_id: lead?.id ?? '', property_id: imovel?.id ?? '' });
      setSelectedProperty(imovel ?? null);
      setSelectedLead(lead ?? null);
      setPropertyQuery(imovel?.title ?? '');
    }
    setPropertyResults([]);
    setShowPropertyDropdown(false);
  }, [open]);

  useEffect(() => {
    setCardEscolhido('');
    if (!open || proposta || pipelineItemId || !form.contact_id) {
      setCardsAbertos(null);
      return;
    }
    let vivo = true;
    pipelinesService.getOpenCardsOfContact(form.contact_id)
      .then(lista => { if (vivo) setCardsAbertos(lista); })
      // Sem a lista, a proposta vai sem ligação (o servidor usa o card aberto mais recente).
      .catch(() => { if (vivo) setCardsAbertos(null); });
    return () => { vivo = false; };
  }, [open, proposta, pipelineItemId, form.contact_id]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (propertyWrapperRef.current && !propertyWrapperRef.current.contains(e.target as Node)) {
        setShowPropertyDropdown(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const searchProperties = (q: string) => {
    setPropertyQuery(q);
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
    setSelectedProperty({ id: p.id, title: p.title, code: p.code });
    setForm(f => ({ ...f, property_id: p.id }));
    setPropertyQuery(p.title);
    setShowPropertyDropdown(false);
  };

  const handleLeadChange = (lead: LeadPickerItem) => {
    setSelectedLead(lead);
    setForm(f => ({ ...f, contact_id: lead.id }));
  };

  // O card da proposta: o de onde ela foi registrada; senão o único aberto do
  // lead; senão o escolhido na pergunta. Editar não mexe na ligação.
  const cardDaProposta = pipelineItemId
    || (cardsAbertos?.length === 1 ? cardsAbertos[0].id : null)
    || cardEscolhido
    || null;

  const handleSave = async () => {
    if (!form.property_id) { toast.error('Selecione um imóvel'); return; }
    if (!form.contact_id) { toast.error('Selecione um lead'); return; }
    if (!form.offered_value) { toast.error('Informe o valor ofertado'); return; }
    setSaving(true);
    try {
      const data: ProposalFormData = {
        property_id: form.property_id,
        contact_id: form.contact_id,
        proposal_type: form.proposal_type,
        offered_value: parseFloat(form.offered_value),
        ...(form.down_payment && { down_payment: parseFloat(form.down_payment) }),
        ...(form.installments && { installments: parseInt(form.installments) }),
        ...(form.payment_method && { payment_method: form.payment_method }),
        ...(form.conditions && { conditions: form.conditions }),
        // Registrada pelo card: vai ligada a ele (aceita, marca ESTE card como Ganho).
        // Editar não mexe na ligação (o update do servidor troca o metadata inteiro).
        ...(!proposta && cardDaProposta ? { metadata: { pipeline_item_id: cardDaProposta } } : {}),
      };
      if (proposta) {
        await proposalsService.update(proposta.id, data);
        toast.success('Proposta atualizada');
      } else {
        await proposalsService.create(data);
        toast.success('Rascunho criado');
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar proposta'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{proposta ? 'Editar Proposta' : 'Nova Proposta'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Imóvel */}
          <div className="relative" ref={propertyWrapperRef}>
            <Label>Imóvel *</Label>
            <div className="relative mt-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar imóvel por título, código ou bairro..."
                value={propertyQuery}
                onChange={e => searchProperties(e.target.value)}
                onFocus={() => { if (propertyResults.length) setShowPropertyDropdown(true); }}
                className="pl-9"
              />
              {propertySearching && (
                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              )}
            </div>
            {showPropertyDropdown && propertyResults.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                {propertyResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0"
                    onClick={() => selectProperty(p)}
                  >
                    <div className="font-medium text-sm truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {[p.code, p.address_neighborhood, p.address_city].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedProperty && (
              <div className="text-xs text-muted-foreground mt-1">
                Selecionado: <span className="font-medium text-foreground">{selectedProperty.code}</span> · {selectedProperty.title}
              </div>
            )}
          </div>

          {/* Lead */}
          <LeadCombobox
            value={selectedLead}
            onChange={handleLeadChange}
            label="Lead *"
            placeholder="Buscar lead ou contato por nome/telefone..."
          />

          {perguntaAtendimento && cardsAbertos && (
            <div className="grid gap-1.5">
              <Label htmlFor="atendimento-da-proposta">De qual atendimento é esta proposta?</Label>
              <Seletor
                id="atendimento-da-proposta"
                value={cardEscolhido}
                onChange={e => setCardEscolhido(e.target.value)}
                className="w-full"
              >
                <option value="" disabled>Escolha o atendimento</option>
                {cardsAbertos.map(c => (
                  <option key={c.id} value={c.id}>{[c.pipeline_name, c.stage_name].filter(Boolean).join(' · ')}</option>
                ))}
              </Seletor>
            </div>
          )}
          {cardsAbertos?.length === 1 && (
            <p className="text-xs text-muted-foreground">
              Atendimento: {[cardsAbertos[0].pipeline_name, cardsAbertos[0].stage_name].filter(Boolean).join(' · ')}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo *</Label>
              <Select
                value={form.proposal_type}
                onValueChange={(v: 'purchase' | 'rent') => setForm(f => ({ ...f, proposal_type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Compra</SelectItem>
                  <SelectItem value="rent">Locação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Ofertado (R$) *</Label>
              <Input
                type="number"
                placeholder="0,00"
                value={form.offered_value}
                onChange={e => setForm(f => ({ ...f, offered_value: e.target.value }))}
              />
            </div>
          </div>

          {form.proposal_type === 'purchase' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entrada (R$)</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={form.down_payment}
                  onChange={e => setForm(f => ({ ...f, down_payment: e.target.value }))}
                />
              </div>
              <div>
                <Label>Parcelas</Label>
                <Input
                  type="number"
                  placeholder="360"
                  value={form.installments}
                  onChange={e => setForm(f => ({ ...f, installments: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div>
            <Label>Forma de Pagamento</Label>
            <Input
              placeholder="Ex: Financiamento bancário, FGTS..."
              value={form.payment_method}
              onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
            />
          </div>

          <div>
            <Label>Condições / Observações</Label>
            <Textarea
              placeholder="Condições específicas da proposta..."
              value={form.conditions}
              onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.property_id || !form.contact_id || !form.offered_value || (!proposta && perguntaAtendimento && !cardEscolhido)}>
            {saving ? 'Salvando...' : proposta ? 'Salvar' : 'Criar Rascunho'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
