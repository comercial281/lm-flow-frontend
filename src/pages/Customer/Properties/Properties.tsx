import { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
} from '@/components/ui/ds';
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
  Upload,
  Link as LinkIcon,
  Film,
  Megaphone,
  LayoutTemplate,
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
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from '@/services/propertyPhotos/propertyPhotosService';
import { useFeature } from '@/contexts/TenantFeaturesContext';

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
  condo_fee: null,
  iptu: null,
  bedrooms: null,
  bathrooms: null,
  suites: null,
  parking_spaces: null,
  useful_area_m2: null,
  total_area_m2: null,
  address_street: '',
  address_number: '',
  address_complement: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  latitude: null,
  longitude: null,
  exclusive: false,
  featured: false,
  published_on_site: false,
  on_sign: false,
  responsible_id: null,
  captor_id: null,
};

const formatCurrency = (v?: number | null) =>
  v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : null;

export default function Properties() {
  const navigate = useNavigate();
  const canCreate      = useFeature('properties_create');
  const canAiDesc      = useFeature('properties_ai_description');
  const canAiBatch     = useFeature('properties_ai_batch');
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const [searchParams]                        = useSearchParams();
  const [search, setSearch]                   = useState(searchParams.get('q') ?? '');
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

  // Preencher com IA (cola texto / book / link do anúncio -> preenche o form)
  const [aiOpen, setAiOpen]       = useState(false);
  const [aiText, setAiText]       = useState('');
  const [aiUrl, setAiUrl]         = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [pdfReading, setPdfReading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [photosProperty, setPhotosProperty] = useState<Property | null>(null);

  // Batch generate
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchSelected, setBatchSelected]   = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning]     = useState(false);
  const [batchResults, setBatchResults]     = useState<Array<{
    id: string; status: 'ok' | 'error'; headline?: string; description?: string; error?: string;
  }> | null>(null);

  const [stats, setStats] = useState<{
    active: number; reserved: number; sold: number; rented: number;
    exclusive: number; featured: number;
  } | null>(null);

  // Sprint 2: usuários do tenant (responsável/captador)
  const [tenantUsers, setTenantUsers] = useState<Array<{ id: string; name: string }>>([]);

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
    // Carrega usuários do tenant pra select de responsável/captador.
    // Tolerante a falha: se endpoint retornar erro, mantém array vazio (UI cai pro "Nenhum").
    import('@/services/users/usersService').then(({ default: svc }) => {
      svc.getUsers({ per_page: 100 })
        .then((res: any) => {
          const list: Array<{ id: string; name: string }> = (res?.data ?? res?.users ?? [])
            .map((u: any) => ({ id: String(u.id), name: u.name || u.email || `user_${u.id}` }));
          setTenantUsers(list);
        })
        .catch(() => setTenantUsers([]));
    }).catch(() => setTenantUsers([]));
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
      condo_fee: p.condo_fee ?? null,
      iptu: p.iptu ?? null,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      suites: p.suites,
      parking_spaces: p.parking_spaces,
      useful_area_m2: p.useful_area_m2,
      total_area_m2: p.total_area_m2 ?? null,
      address_street: p.address_street ?? '',
      address_number: p.address_number ?? '',
      address_complement: p.address_complement ?? '',
      address_neighborhood: p.address_neighborhood ?? '',
      address_city: p.address_city ?? '',
      address_state: p.address_state ?? '',
      address_zip: p.address_zip ?? '',
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      exclusive: p.exclusive ?? false,
      featured: p.featured ?? false,
      published_on_site: p.published_on_site ?? false,
      on_sign: p.on_sign ?? false,
      responsible_id: p.responsible?.id ?? p.responsible_id ?? null,
      captor_id: p.captor?.id ?? p.captor_id ?? null,
      owner_contact_id: p.owner_contact_id ?? null,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título é obrigatório'); return; }
    // Valor de venda é obrigatório p/ Venda/Venda e Locação (regra do backend) —
    // avisa antes de bater na API.
    if ((form.transaction_type === 'sale' || form.transaction_type === 'sale_rent') && !form.sale_price) {
      toast.error('Informe o Valor de venda (obrigatório para imóveis à venda).');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await propertiesService.update(editing.id, form);
        setProperties(prev => prev.map(p => p.id === updated.id ? updated : p));
        toast.success('Imóvel atualizado');
        setModalOpen(false);
      } else {
        const created = await propertiesService.create(form);
        setProperties(prev => [created, ...prev]);
        setTotal(t => t + 1);
        toast.success('Imóvel cadastrado — agora envie as fotos');
        setModalOpen(false);
        setPhotosProperty(created);
      }
    } catch (e) {
      // Surfaça a mensagem real do backend (ex.: "Valor de venda é obrigatório...")
      // em vez de um genérico que deixa o usuário sem saber o que corrigir.
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string } } };
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Erro ao salvar imóvel';
      toast.error(msg);
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

  const handleBatchGenerate = async () => {
    if (batchSelected.size === 0) { toast.error('Selecione ao menos um imóvel'); return; }
    setBatchRunning(true);
    setBatchResults(null);
    try {
      const results = await propertiesService.batchGenerateDescriptions(Array.from(batchSelected));
      setBatchResults(results);
      const ok = results.filter(r => r.status === 'ok').length;
      toast.success(`${ok} descrição${ok !== 1 ? 'ões' : ''} gerada${ok !== 1 ? 's' : ''}`);
      load();
    } catch {
      toast.error('Erro na geração em lote');
    } finally {
      setBatchRunning(false);
    }
  };

  const toggleBatchSelect = (id: string) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const f = form;
  const setF = (patch: Partial<PropertyFormData>) => setForm(prev => ({ ...prev, ...patch }));

  // IA lê o texto colado / book (PDF) / link do anúncio e preenche o form (sem salvar).
  const doAiExtract = async (text: string, url: string) => {
    if (!text && !url) { toast.error('Cole um texto, envie um PDF ou um link do imóvel'); return; }
    setAiRunning(true);
    try {
      const r = await propertiesService.aiExtract({ text: text || undefined, url: url || undefined });
      const patch: Partial<PropertyFormData> = {};
      const put = <K extends keyof PropertyFormData>(k: K, v: PropertyFormData[K] | null | undefined) => {
        if (v !== null && v !== undefined && v !== '') patch[k] = v;
      };
      put('title', r.title);
      put('transaction_type', r.transaction_type);
      put('property_type', r.property_type);
      put('sale_price', r.sale_price);
      put('rent_price', r.rent_price);
      put('condo_fee', r.condo_fee);
      put('iptu', r.iptu);
      put('bedrooms', r.bedrooms);
      put('bathrooms', r.bathrooms);
      put('suites', r.suites);
      put('parking_spaces', r.parking_spaces);
      put('useful_area_m2', r.useful_area_m2);
      put('total_area_m2', r.total_area_m2);
      put('address_neighborhood', r.address_neighborhood);
      put('address_city', r.address_city);
      put('address_state', r.address_state);
      put('address_zip', r.address_cep);       // backend usa cep, form usa zip
      put('address_street', r.address_street);
      put('description', r.description);
      const filled = Object.keys(patch).length;
      if (!filled) { toast.error('A IA não achou dados no material. Revise o texto/link.'); return; }
      setF(patch);
      toast.success(`IA preencheu ${filled} campo${filled > 1 ? 's' : ''}. Revise e ajuste antes de salvar.`);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || 'Não consegui ler o material. Tente colar o texto direto.');
    } finally {
      setAiRunning(false);
    }
  };

  const runAiExtract = () => doAiExtract(aiText.trim(), aiUrl.trim());

  // Book em PDF: extrai o texto no próprio navegador (pdf.js via CDN) e manda pra IA.
  // Sem dependência nova no projeto; PDF escaneado (só imagem) não tem texto e avisa.
  const onPickPdf = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Envie um arquivo PDF do book.');
      return;
    }
    setPdfReading(true);
    try {
      // specifier em variável: o TS não tenta resolver o módulo do CDN (não é dep local)
      const cdnBase = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjs: any = await import(/* @vite-ignore */ `${cdnBase}/pdf.min.mjs`);
      pdfjs.GlobalWorkerOptions.workerSrc = `${cdnBase}/pdf.worker.min.mjs`;
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const pages = Math.min(pdf.numPages, 30);
      let text = '';
      for (let p = 1; p <= pages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        text += content.items.map((it: any) => it.str ?? '').join(' ') + '\n';
      }
      text = text.trim();
      if (!text) {
        toast.error('Esse PDF não tem texto (parece escaneado/imagem). Cole o texto do book.');
        return;
      }
      setAiText(prev => (prev ? `${prev}\n\n${text}` : text));
      toast.success('Book lido. Enviando pra IA...');
      await doAiExtract(text, '');
    } catch {
      toast.error('Não consegui ler o PDF. Tente colar o texto do book.');
    } finally {
      setPdfReading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Imóveis
            </h1>
            <p className="text-sm text-muted-foreground">{total} imóvel{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/properties/map')}>
              <MapPin className="h-4 w-4 mr-2" />
              Ver no mapa
            </Button>
            <Button variant="outline" onClick={() => navigate('/landings')}>
              <Megaphone className="h-4 w-4 mr-2" />
              Landings
            </Button>
            <Button variant="outline" onClick={() => navigate('/properties/template-imovel')}>
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Página de imóvel
            </Button>
            {canAiBatch && (
              <Button variant="outline" onClick={() => { setBatchSelected(new Set()); setBatchResults(null); setBatchModalOpen(true); }}>
                <Wand2 className="h-4 w-4 mr-2" />
                IA em lote
              </Button>
            )}
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar imóvel
              </Button>
            )}
          </div>
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
          <span><strong className="text-orange-600">{stats.featured}</strong> em destaque</span>
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
            {canCreate && (
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar imóvel
              </Button>
            )}
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
                onLanding={p => navigate(`/properties/${p.id}/landing`)}
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

          {/* Preencher com IA — cola texto / book / link do anúncio e a IA distribui nos campos */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              className="flex w-full items-center gap-2 text-sm font-medium text-primary"
            >
              <Wand2 className="h-4 w-4" />
              Preencher com IA
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {aiOpen ? 'ocultar' : 'texto, PDF do book ou link'}
              </span>
            </button>

            {aiOpen && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={aiText}
                  onChange={e => setAiText(e.target.value)}
                  placeholder="Cole aqui todas as informações do imóvel (texto do book, anúncio, descrição...). A IA lê e distribui em cada campo, e escreve a descrição no tom certo. Nada é obrigatório."
                  className="min-h-[100px]"
                />
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <Input
                    value={aiUrl}
                    onChange={e => setAiUrl(e.target.value)}
                    placeholder="Ou cole o link de um anúncio (ex: portal, site do imóvel)"
                  />
                </div>

                {/* Book em PDF: input escondido + botão que dispara a leitura no navegador */}
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={e => { onPickPdf(e.target.files?.[0]); e.target.value = ''; }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={pdfReading || aiRunning}
                >
                  {pdfReading
                    ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Lendo o PDF...</>
                    : <><Upload className="mr-1 h-4 w-4" /> Subir PDF do book</>}
                </Button>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    A IA só preenche o que estiver no material. Você revisa antes de salvar.
                  </p>
                  <Button type="button" size="sm" onClick={runAiExtract} disabled={aiRunning || pdfReading}>
                    {aiRunning
                      ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Lendo...</>
                      : <><Wand2 className="mr-1 h-4 w-4" /> Preencher</>}
                  </Button>
                </div>
              </div>
            )}
          </div>

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
                  <UILabel>Valor de venda (R$) *</UILabel>
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
              <div>
                <UILabel>Condomínio (R$/mês)</UILabel>
                <Input type="number" value={f.condo_fee ?? ''} onChange={e => setF({ condo_fee: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="800" className="mt-1" />
              </div>
              <div>
                <UILabel>IPTU (R$/ano)</UILabel>
                <Input type="number" value={f.iptu ?? ''} onChange={e => setF({ iptu: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="1200" className="mt-1" />
              </div>
            </div>

            {/* Specs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Quartos', key: 'bedrooms' as const },
                { label: 'Banheiros', key: 'bathrooms' as const },
                { label: 'Suítes', key: 'suites' as const },
                { label: 'Vagas', key: 'parking_spaces' as const },
                { label: 'Área útil (m²)', key: 'useful_area_m2' as const },
                { label: 'Área total (m²)', key: 'total_area_m2' as const },
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
                <UILabel>Complemento</UILabel>
                <Input value={f.address_complement ?? ''} onChange={e => setF({ address_complement: e.target.value })}
                  placeholder="Apto 102" className="mt-1" />
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
              <div>
                <UILabel className="text-xs text-muted-foreground">Latitude (opcional, p/ mapa)</UILabel>
                <Input type="number" step="any" value={f.latitude ?? ''} onChange={e => setF({ latitude: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="-23.5505" className="mt-1" />
              </div>
              <div>
                <UILabel className="text-xs text-muted-foreground">Longitude (opcional, p/ mapa)</UILabel>
                <Input type="number" step="any" value={f.longitude ?? ''} onChange={e => setF({ longitude: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="-46.6333" className="mt-1" />
              </div>
            </div>

            {/* Atribuição: responsável + captador */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <UILabel>Corretor responsável</UILabel>
                <select
                  value={f.responsible_id ?? ''}
                  onChange={e => setF({ responsible_id: e.target.value || null })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Nenhum</option>
                  {tenantUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <UILabel>Captador</UILabel>
                <select
                  value={f.captor_id ?? ''}
                  onChange={e => setF({ captor_id: e.target.value || null })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Nenhum</option>
                  {tenantUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <UILabel>Descrição</UILabel>
                {editing && canAiDesc && (
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
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={f.exclusive} onChange={e => setF({ exclusive: e.target.checked })} className="rounded" />
                <span className="text-sm">Exclusividade</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={f.featured} onChange={e => setF({ featured: e.target.checked })} className="rounded" />
                <span className="text-sm">Destaque</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={f.published_on_site ?? false} onChange={e => setF({ published_on_site: e.target.checked })} className="rounded" />
                <span className="text-sm">Publicar no site</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={f.on_sign ?? false} onChange={e => setF({ on_sign: e.target.checked })} className="rounded" />
                <span className="text-sm">Tem placa</span>
              </label>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <div>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setPhotosProperty(editing); }}
                  className="gap-2"
                >
                  <Image className="h-4 w-4" />
                  Gerenciar fotos
                </Button>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Cadastrar e enviar fotos'}
              </Button>
            </div>
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

      {/* Batch generate dialog */}
      <Dialog open={batchModalOpen} onOpenChange={open => { if (!batchRunning) setBatchModalOpen(open); }}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Geração de descrições em lote
            </DialogTitle>
            <DialogDescription>
              Selecione os imóveis e gere descrições com IA para todos de uma vez.
            </DialogDescription>
          </DialogHeader>

          {!batchResults ? (
            <>
              <div className="flex items-center justify-between mb-2 mt-1">
                <span className="text-xs text-muted-foreground">{batchSelected.size} selecionado{batchSelected.size !== 1 ? 's' : ''}</span>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setBatchSelected(
                    batchSelected.size === properties.length
                      ? new Set()
                      : new Set(properties.map(p => p.id))
                  )}
                >
                  {batchSelected.size === properties.length ? 'Desselecionar todos' : 'Selecionar todos'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {properties.map(p => (
                  <label key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchSelected.has(p.id)}
                      onChange={() => toggleBatchSelect(p.id)}
                      className="rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.code} · {PROPERTY_TYPE_LABELS[p.property_type] ?? p.property_type}</p>
                    </div>
                    {p.description && <span className="text-xs text-emerald-600 flex-shrink-0">desc</span>}
                  </label>
                ))}
              </div>
              <DialogFooter className="mt-3">
                <Button variant="outline" onClick={() => setBatchModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleBatchGenerate} disabled={batchRunning || batchSelected.size === 0}>
                  {batchRunning
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                    : <><Wand2 className="h-4 w-4 mr-2" />Gerar {batchSelected.size > 0 ? batchSelected.size : ''} descriç{batchSelected.size !== 1 ? 'ões' : 'ão'}</>
                  }
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 mt-1 pr-1">
                {batchResults.map(r => {
                  const prop = properties.find(p => p.id === r.id);
                  return (
                    <div key={r.id} className={`p-3 rounded-lg border ${r.status === 'ok' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'}`}>
                      <p className="text-sm font-medium truncate">{prop?.title ?? r.id}</p>
                      {r.status === 'ok' && r.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                      )}
                      {r.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1">{r.error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <DialogFooter className="mt-3">
                <Button onClick={() => setBatchModalOpen(false)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PropertyCard({
  property: p,
  onEdit,
  onDelete,
  onManagePhotos,
  onLanding,
  score,
  onCalculateScore,
  scoringId,
}: {
  property: Property;
  onEdit: (p: Property) => void;
  onDelete: (p: Property) => void;
  onManagePhotos: (p: Property) => void;
  onLanding: (p: Property) => void;
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
            <Star className="h-4 w-4 text-violet-400 fill-violet-400" />
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
          <Button size="sm" variant="secondary" onClick={() => onLanding(p)} title="Landing Page de anúncio">
            <Megaphone className="h-3.5 w-3.5" />
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
                score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-orange-600' : 'text-red-500'
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

function PropertyPhotosDialog({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState('main');
  const [newCaption, setNewCaption] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const validateFiles = (files: File[]): { ok: File[]; rejected: string[] } => {
    const ok: File[] = [];
    const rejected: string[] = [];
    files.forEach(f => {
      if (!ACCEPTED_MIME_TYPES.includes(f.type)) {
        rejected.push(`${f.name}: tipo não suportado (${f.type || 'desconhecido'})`);
        return;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        rejected.push(`${f.name}: maior que ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB`);
        return;
      }
      ok.push(f);
    });
    return { ok, rejected };
  };

  const handleUpload = async (rawFiles: File[]) => {
    const { ok, rejected } = validateFiles(rawFiles);
    rejected.forEach(msg => toast.error(msg));
    if (!ok.length) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const created = await propertyPhotosService.upload(property.id, ok, {
        photoType: newType,
        published: true,
        onProgress: setUploadProgress,
      });
      setPhotos(prev => [...prev, ...created]);
      toast.success(`${created.length} foto${created.length !== 1 ? 's' : ''} enviada${created.length !== 1 ? 's' : ''}`);
    } catch (e) {
      toast.error('Erro ao enviar fotos');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void handleUpload(files);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void handleUpload(files);
  };

  const handleAddByUrl = async () => {
    if (!newUrl.trim()) { toast.error('URL da foto é obrigatória'); return; }
    setAddingUrl(true);
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
      toast.success('Foto adicionada por URL');
    } catch {
      toast.error('Erro ao adicionar foto');
    } finally {
      setAddingUrl(false);
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

        {/* Dropzone — upload nativo de fotos e vídeos */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors text-center ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_MIME_TYPES.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">Enviando {uploadProgress}%...</p>
              <div className="w-full max-w-xs bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2 text-primary">
                <Upload className="h-7 w-7" />
                <Film className="h-7 w-7 opacity-60" />
              </div>
              <p className="text-sm font-medium">Arraste fotos ou vídeos aqui, ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">
                Aceita JPG, PNG, WebP, HEIC, MP4, MOV, WebM · máx {MAX_UPLOAD_BYTES / (1024 * 1024)}MB por arquivo
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <UILabel className="text-xs text-muted-foreground shrink-0">Categorizar como:</UILabel>
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            disabled={uploading}
          >
            {Object.entries(PHOTO_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowUrlInput(s => !s)}
            className="ml-auto text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <LinkIcon className="h-3 w-3" />
            {showUrlInput ? 'Ocultar URL externa' : 'Adicionar por URL externa'}
          </button>
        </div>

        {showUrlInput && (
          <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://... (URL pública da imagem/vídeo já hospedado)"
                className="flex-1 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Input
                value={newCaption}
                onChange={e => setNewCaption(e.target.value)}
                placeholder="Legenda (opcional)"
                className="flex-1 text-sm"
              />
              <Button onClick={handleAddByUrl} disabled={addingUrl} size="sm">
                {addingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Adicionar
              </Button>
            </div>
          </div>
        )}

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
            {photos.map(photo => {
              const isVideo = photo.content_type?.startsWith('video/') || photo.photo_type === 'video';
              return (
              <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted aspect-video">
                {isVideo ? (
                  <video
                    src={photo.file_url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    controls
                  />
                ) : (
                  <img
                    src={photo.thumbnail_url || photo.file_url}
                    alt={photo.alt_text ?? photo.caption ?? ''}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}

                {/* Badges */}
                <div className="absolute top-1.5 left-1.5 flex gap-1">
                  {photo.is_cover && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500 text-white font-medium flex items-center gap-0.5">
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
                      className="p-1.5 rounded bg-orange-500 text-white hover:bg-orange-600"
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
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
