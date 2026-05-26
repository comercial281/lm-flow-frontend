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
  Search,
  Building2,
  Bed,
  Bath,
  Car,
  Ruler,
  MapPin,
  Edit,
  Trash2,
  Star,
  Lock,
  CheckCircle2,
  Wand2,
  Gauge,
  Loader2,
  Image,
  X,
  Crown,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  propertiesService,
  Property,
  PropertyFormData,
  TRANSACTION_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/services/properties/propertiesService';
import {
  propertyPhotosService,
  PropertyPhoto,
  PHOTO_TYPE_LABELS,
} from '@/services/propertyPhotos/propertyPhotosService';

const EMPTY_FORM: PropertyFormData = {
  title: '',
  description: '',
  transaction_type: 'sale',
  category_type: 'residential',
  property_type: 'apartment',
  status: 'active',
  stage: 'ready',
  sale_price: null,
  rent_price: null,
  bedrooms: null,
  bathrooms: null,
  suites: null,
  parking_spaces: null,
  useful_area_m2: null,
  address_street: '',
  address_number: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  exclusive: false,
  featured: false,
};

const formatCurrency = (v?: number | null) =>
  v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : null;

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const [search, setSearch]                   = useState('');
  const [filterStatus, setFilterStatus]       = useState('');
  const [filterType, setFilterType]           = useState('');
  const [filterTransaction, setFilterTransaction] = useState('');

  const [modalOpen, setModalOpen]       = useState(false);
  const [editing, setEditing]           = useState<Property | null>(null);
  const [form, setForm]                 = useState<PropertyFormData>(EMPTY_FORM);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete]                 = useState<Property | null>(null);
  const [generatingDesc, setGeneratingDesc]     = useState(false);
  const [cepLoading, setCepLoading]             = useState(false);
  const [propertyScores, setPropertyScores]     = useState<Record<string, number>>({});
  const [scoringId, setScoringId]               = useState<string | null>(null);

  const [photosProperty, setPhotosProperty] = useState<Property | null>(null);
  const [stats, setStats] = useState<{
    active: number; reserved: number; sold: number; rented: number;
    exclusive: number; featured: number;
  } | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q = search, status = filterStatus, type = filterType, transaction = filterTransaction) => {
    setLoading(true);
    try {
      const res = await propertiesService.list({
        q: q || undefined,
        status: status || undefined,
        property_type: type || undefined,
        transaction_type: transaction || undefined,
        per_page: 60,
      });
      setProperties(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch {
      toast.error('Erro ao carregar imóveis');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterType, filterTransaction]);

  useEffect(() => {
    load();
    propertiesService.stats().then(setStats).catch(() => {});
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(val, filterStatus, filterType, filterTransaction), 400);
  };

  const applyFilter = (s: string, t: string, tr: string) => {
    setFilterStatus(s);
    setFilterType(t);
    setFilterTransaction(tr);
    load(search, s, t, tr);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (p: Property) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? '',
      transaction_type: p.transaction_type,
      category_type: p.category_type,
      property_type: p.property_type,
      status: p.status,
      stage: p.stage,
      sale_price: p.sale_price,
      rent_price: p.rent_price,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      suites: p.suites,
      parking_spaces: p.parking_spaces,
      useful_area_m2: p.useful_area_m2,
      address_street: p.address_street ?? '',
      address_number: p.address_number ?? '',
      address_neighborhood: p.address_neighborhood ?? '',
      address_city: p.address_city ?? '',
      address_state: p.address_state ?? '',
      address_zip: p.address_zip ?? '',
      exclusive: p.exclusive ?? false,
      featured: p.featured ?? false,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return; }
    setSaving(true);
    try {
      if (editing) {
        const updated = await propertiesService.update(editing.id, form);
        setProperties(prev => prev.map(p => p.id === updated.id ? updated : p));
        toast.success('Imóvel atualizado');
      } else {
        const created = await propertiesService.create(form);
        setProperties(prev => [created, ...prev]);
        setTotal(t => t + 1);
        toast.success('Imóvel cadastrado');
      }
      setModalOpen(false);
    } catch {
      toast.error('Erro ao salvar imóvel');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await propertiesService.delete(toDelete.id);
      setProperties(prev => prev.filter(p => p.id !== toDelete.id));
      setTotal(t => t - 1);
      toast.success('Imóvel removido');
      setDeleteDialogOpen(false);
    } catch {
      toast.error('Erro ao remover imóvel');
    } finally {
      setDeleting(false);
    }
  };

  const handleCepLookup = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const data = await propertiesService.cepLookup(clean);
      setForm(prev => ({
        ...prev,
        address_street: data.logradouro || prev.address_street,
        address_neighborhood: data.bairro || prev.address_neighborhood,
        address_city: data.localidade || prev.address_city,
        address_state: data.uf || prev.address_state,
      }));
    } catch {
      // silent — CEP not found is non-fatal
    } finally {
      setCepLoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!editing) return;
    setGeneratingDesc(true);
    try {
      const result = await propertiesService.generateDescription(editing.id, { apply: true });
      setForm(prev => ({ ...prev, description: result.description }));
      if (result.headline) setForm(prev => ({ ...prev, title: result.headline || prev.title }));
      toast.success('Descrição gerada com IA');
    } catch {
      toast.error('Erro ao gerar descrição. Verifique se a chave de IA está configurada.');
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleCalculateScore = async (id: string) => {
    setScoringId(id);
    try {
      const result = await propertiesService.calculateScore(id);
      setPropertyScores(prev => ({ ...prev, [id]: result.score }));
    } catch {
      // silent
    } finally {
      setScoringId(null);
    }
  };

  const f = form;
  const setF = (patch: Partial<PropertyFormData>) => setForm(prev => ({ ...prev, ...patch }));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Imóveis
            </h1>
            <p className="text-sm text-muted-foreground">{total} imóvel{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar imóvel
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, código, cidade..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <select
            value={filterTransaction}
            onChange={e => applyFilter(filterStatus, filterType, e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tipo de negócio</option>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={e => applyFilter(filterStatus, e.target.value, filterTransaction)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tipo de imóvel</option>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => applyFilter(e.target.value, filterType, filterTransaction)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          {(filterStatus || filterType || filterTransaction || search) && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterType(''); setFilterTransaction(''); load('', '', '', ''); }}
              className="text-xs text-primary hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="border-b px-6 py-2 flex flex-wrap gap-4 text-xs text-muted-foreground bg-muted/30">
          <span><strong className="text-foreground">{stats.active}</strong> ativos</span>
          <span><strong className="text-foreground">{stats.reserved}</strong> reservados</span>
          <span><strong className="text-foreground">{stats.sold}</strong> vendidos</span>
          <span><strong className="text-foreground">{stats.rented}</strong> alugados</span>
          <span><strong className="text-violet-600">{stats.exclusive}</strong> exclusivos</span>
          <span><strong className="text-amber-600">{stats.featured}</strong> em destaque</span>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando imóveis...
          </div>
        ) : properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mb-3" />
            <p className="text-sm font-medium">Nenhum imóvel encontrado</p>
            <p className="text-xs mt-1">Cadastre o primeiro imóvel do seu portfólio</p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar imóvel
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {properties.map(property => (
              <PropertyCard
                key={property.id}
                property={property}
                onEdit={openEdit}
                onDelete={p => { setToDelete(p); setDeleteDialogOpen(true); }}
                onManagePhotos={p => setPhotosProperty(p)}
                score={propertyScores[property.id]}
                onCalculateScore={() => handleCalculateScore(property.id)}
                scoringId={scoringId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar imóvel' : 'Cadastrar imóvel'}</DialogTitle>
            <DialogDescription>Preencha as informações do imóvel</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Basic */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <UILabel>Título *</UILabel>
                <Input
                  value={f.title}
                  onChange={e => setF({ title: e.target.value })}
                  placeholder="Ex: Apartamento 3 quartos - Jardim Europa"
                  className="mt-1"
                />
              </div>

              <div>
                <UILabel>Tipo de negócio</UILabel>
                <select value={f.transaction_type} onChange={e => setF({ transaction_type: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {Object.entries(TRANSACTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <UILabel>Tipo de imóvel</UILabel>
                <select value={f.property_type} onChange={e => setF({ property_type: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <UILabel>Status</UILabel>
                <select value={f.status} onChange={e => setF({ status: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <UILabel>Estágio</UILabel>
                <select value={f.stage} onChange={e => setF({ stage: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="ready">Pronto</option>
                  <option value="in_construction">Em construção</option>
                  <option value="launch">Lançamento</option>
                  <option value="pre_launch">Pré-lançamento</option>
                </select>
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              {(f.transaction_type === 'sale' || f.transaction_type === 'sale_rent') && (
                <div>
                  <UILabel>Valor de venda (R$)</UILabel>
                  <Input type="number" value={f.sale_price ?? ''} onChange={e => setF({ sale_price: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="450000" className="mt-1" />
                </div>
              )}
              {(f.transaction_type === 'rent' || f.transaction_type === 'sale_rent' || f.transaction_type === 'season') && (
                <div>
                  <UILabel>Valor de aluguel (R$)</UILabel>
                  <Input type="number" value={f.rent_price ?? ''} onChange={e => setF({ rent_price: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="2500" className="mt-1" />
                </div>
              )}
            </div>

            {/* Specs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Quartos', key: 'bedrooms' as const },
                { label: 'Banheiros', key: 'bathrooms' as const },
                { label: 'Suítes', key: 'suites' as const },
                { label: 'Vagas', key: 'parking_spaces' as const },
                { label: 'Área útil (m²)', key: 'useful_area_m2' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <UILabel>{label}</UILabel>
                  <Input type="number" value={f[key] ?? ''} onChange={e => setF({ [key]: e.target.value ? parseFloat(e.target.value) : null })}
                    min={0} className="mt-1" />
                </div>
              ))}
            </div>

            {/* Address */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <UILabel>CEP</UILabel>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={f.address_zip}
                    onChange={e => setF({ address_zip: e.target.value })}
                    onBlur={e => handleCepLookup(e.target.value)}
                    placeholder="01310-100"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cepLoading}
                    onClick={() => handleCepLookup(f.address_zip ?? '')}
                    className="shrink-0"
                  >
                    {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                  </Button>
                </div>
              </div>
              <div className="col-span-2">
                <UILabel>Rua</UILabel>
                <Input value={f.address_street} onChange={e => setF({ address_street: e.target.value })}
                  placeholder="Av. Paulista" className="mt-1" />
              </div>
              <div>
                <UILabel>Número</UILabel>
                <Input value={f.address_number} onChange={e => setF({ address_number: e.target.value })}
                  placeholder="1578" className="mt-1" />
              </div>
              <div>
                <UILabel>Bairro</UILabel>
                <Input value={f.address_neighborhood} onChange={e => setF({ address_neighborhood: e.target.value })}
                  placeholder="Bela Vista" className="mt-1" />
              </div>
              <div>
                <UILabel>Cidade</UILabel>
                <Input value={f.address_city} onChange={e => setF({ address_city: e.target.value })}
                  placeholder="São Paulo" className="mt-1" />
              </div>
              <div>
                <UILabel>Estado (UF)</UILabel>
                <Input value={f.address_state} onChange={e => setF({ address_state: e.target.value })}
                  placeholder="SP" maxLength={2} className="mt-1" />
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <UILabel>Descrição</UILabel>
                {editing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={generatingDesc}
                    onClick={handleGenerateDescription}
                    className="h-7 text-xs gap-1"
                  >
                    {generatingDesc
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Wand2 className="h-3 w-3" />
                    }
                    Gerar com IA
                  </Button>
                )}
              </div>
              <Textarea value={f.description} onChange={e => setF({ description: e.target.value })}
                rows={3} placeholder="Descreva o imóvel..." className="resize-none" />
            </div>

            {/* Flags */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={f.exclusive} onChange={e => setF({ exclusive: e.target.checked })} className="rounded" />
                <span className="text-sm">Exclusividade</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={f.featured} onChange={e => setF({ featured: e.target.checked })} className="rounded" />
                <span className="text-sm">Destaque</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover imóvel</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <strong>{toDelete?.title}</strong>? O histórico será preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photos dialog */}
      {photosProperty && (
        <PropertyPhotosDialog
          property={photosProperty}
          onClose={() => setPhotosProperty(null)}
        />
      )}
    </div>
  );
}

function PropertyCard({
  property: p,
  onEdit,
  onDelete,
  onManagePhotos,
  score,
  onCalculateScore,
  scoringId,
}: {
  property: Property;
  onEdit: (p: Property) => void;
  onDelete: (p: Property) => void;
  onManagePhotos: (p: Property) => void;
  score?: number;
  onCalculateScore: () => void;
  scoringId: string | null;
}) {
  const price = p.display_price
    ?? formatCurrency(p.sale_price)
    ?? formatCurrency(p.rent_price);

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card hover:shadow-md transition-shadow overflow-hidden">
      {/* Placeholder thumbnail */}
      <div className="h-36 bg-muted flex items-center justify-center relative">
        <Building2 className="h-10 w-10 text-muted-foreground/30" />
        <div className="absolute top-2 left-2 flex gap-1">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[p.status] ?? ''}`}>
            {STATUS_LABELS[p.status] ?? p.status}
          </span>
          {p.exclusive && (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" />
              Exclusivo
            </span>
          )}
        </div>
        {p.featured && (
          <div className="absolute top-2 right-2">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          </div>
        )}

        {/* Action buttons on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(p)}>
            <Edit className="h-3.5 w-3.5 mr-1" />
            Editar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onManagePhotos(p)} title="Gerenciar fotos">
            <Image className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(p)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 mb-1">
          <Badge variant="outline" className="text-xs">
            {TRANSACTION_TYPE_LABELS[p.transaction_type] ?? p.transaction_type}
          </Badge>
          <span className="text-xs text-muted-foreground">{PROPERTY_TYPE_LABELS[p.property_type] ?? p.property_type}</span>
        </div>

        <h3 className="font-medium text-sm line-clamp-2 mb-2 flex-1">{p.title}</h3>

        {price && (
          <p className="text-lg font-bold text-primary mb-2">{price}</p>
        )}

        {/* Icon summary */}
        {p.icon_summary && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            {p.icon_summary.bedrooms > 0 && (
              <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{p.icon_summary.bedrooms}</span>
            )}
            {p.icon_summary.bathrooms > 0 && (
              <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{p.icon_summary.bathrooms}</span>
            )}
            {p.icon_summary.parking > 0 && (
              <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{p.icon_summary.parking}</span>
            )}
            {p.icon_summary.useful_area_m2 > 0 && (
              <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" />{p.icon_summary.useful_area_m2}m²</span>
            )}
          </div>
        )}

        {p.address_city && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {[p.address_neighborhood, p.address_city, p.address_state].filter(Boolean).join(', ')}
            </span>
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
          <div className="flex items-center gap-2">
            {score != null ? (
              <span className={`text-xs font-medium flex items-center gap-1 ${
                score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-500'
              }`}>
                <Gauge className="h-3 w-3" />
                {score}%
              </span>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onCalculateScore(); }}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                disabled={scoringId === p.id}
                title="Calcular força do anúncio"
              >
                {scoringId === p.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Gauge className="h-3 w-3" />
                }
              </button>
            )}
            {p.status === 'active' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(v?: number | null): string | null {
  if (v == null) return null;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
}

function PropertyPhotosDialog({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState('main');
  const [newCaption, setNewCaption] = useState('');

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      setPhotos(await propertyPhotosService.list(property.id));
    } catch {
      toast.error('Erro ao carregar fotos');
    } finally {
      setLoading(false);
    }
  }, [property.id]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const handleAdd = async () => {
    if (!newUrl.trim()) { toast.error('URL da foto é obrigatória'); return; }
    setAdding(true);
    try {
      const photo = await propertyPhotosService.create(property.id, {
        file_url: newUrl.trim(),
        photo_type: newType,
        caption: newCaption.trim() || undefined,
        published: true,
      });
      setPhotos(prev => [...prev, photo]);
      setNewUrl('');
      setNewCaption('');
      toast.success('Foto adicionada');
    } catch {
      toast.error('Erro ao adicionar foto');
    } finally {
      setAdding(false);
    }
  };

  const handleSetCover = async (photo: PropertyPhoto) => {
    try {
      await propertyPhotosService.setAsCover(property.id, photo.id);
      setPhotos(prev => prev.map(p => ({ ...p, is_cover: p.id === photo.id })));
      toast.success('Capa atualizada');
    } catch {
      toast.error('Erro ao definir capa');
    }
  };

  const handleTogglePublished = async (photo: PropertyPhoto) => {
    try {
      const updated = await propertyPhotosService.update(property.id, photo.id, { published: !photo.published });
      setPhotos(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch {
      toast.error('Erro ao atualizar visibilidade');
    }
  };

  const handleDelete = async (photo: PropertyPhoto) => {
    try {
      await propertyPhotosService.delete(property.id, photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      toast.success('Foto removida');
    } catch {
      toast.error('Erro ao remover foto');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Fotos — {property.title}
          </DialogTitle>
          <DialogDescription>
            {photos.length} foto{photos.length !== 1 ? 's' : ''} cadastrada{photos.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Add photo */}
        <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Adicionar foto por URL</p>
          <div className="flex gap-2">
            <Input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://... (URL pública da imagem)"
              className="flex-1 text-sm"
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(PHOTO_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Input
              value={newCaption}
              onChange={e => setNewCaption(e.target.value)}
              placeholder="Legenda (opcional)"
              className="flex-1 text-sm"
            />
            <Button onClick={handleAdd} disabled={adding} size="sm">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Adicionar
            </Button>
          </div>
        </div>

        {/* Photo list */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando fotos...
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Image className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma foto cadastrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted aspect-video">
                <img
                  src={photo.file_url}
                  alt={photo.alt_text ?? photo.caption ?? ''}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />

                {/* Badges */}
                <div className="absolute top-1.5 left-1.5 flex gap-1">
                  {photo.is_cover && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500 text-white font-medium flex items-center gap-0.5">
                      <Crown className="h-2.5 w-2.5" />
                      Capa
                    </span>
                  )}
                  {!photo.published && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-white font-medium">
                      Oculta
                    </span>
                  )}
                </div>

                {/* Type label */}
                <div className="absolute bottom-1.5 left-1.5">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-black/60 text-white">
                    {PHOTO_TYPE_LABELS[photo.photo_type] ?? photo.photo_type}
                  </span>
                </div>

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {!photo.is_cover && (
                    <button
                      onClick={() => handleSetCover(photo)}
                      className="p-1.5 rounded bg-amber-500 text-white hover:bg-amber-600"
                      title="Definir como capa"
                    >
                      <Crown className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleTogglePublished(photo)}
                    className="p-1.5 rounded bg-slate-600 text-white hover:bg-slate-700"
                    title={photo.published ? 'Ocultar' : 'Publicar'}
                  >
                    {photo.published
                      ? <EyeOff className="h-3.5 w-3.5" />
                      : <Eye className="h-3.5 w-3.5" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(photo)}
                    className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700"
                    title="Remover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
