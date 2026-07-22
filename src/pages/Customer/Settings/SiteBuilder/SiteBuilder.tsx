import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label as UILabel,
  Textarea,
  Badge,
} from '@/components/ui/ds';
import {
  Globe, Plus, Edit, Trash2, FileText, Newspaper,
  ExternalLink, Archive, Send, RefreshCw, Users,
  LayoutTemplate, Copy, Check, Home, Building2, Search, MessageCircle,
  Upload, Loader2, Sparkles,
} from 'lucide-react';
import { getTenantSlug } from '@/services/core/tenant';
import LeadRoutingFields from '@/components/pipelines/LeadRoutingFields';
import { extractLogoColors } from '@/utils/logoColors';
import {
  siteBuilderService,
  Site,
  SitePage,
  SiteArticle,
  SiteLead,
  SiteFormData,
  PageFormData,
  ArticleFormData,
  ARTICLE_STATUS_LABELS,
  ARTICLE_STATUS_COLORS,
  SITE_LEAD_STATUS_LABELS,
  SITE_LEAD_STATUS_COLORS,
} from '@/services/siteBuilder/siteBuilderService';

const TABS = [
  { key: 'portal', label: 'Portal', icon: LayoutTemplate },
  { key: 'config', label: 'Configurações', icon: Globe },
  { key: 'pages', label: 'Páginas', icon: FileText },
  { key: 'articles', label: 'Artigos', icon: Newspaper },
  { key: 'leads', label: 'Leads', icon: Users },
];

const SITE_FONTS = ['Inter', 'Space Grotesk', 'Lato', 'Poppins', 'Montserrat', 'Roboto'];

const EMPTY_SITE_FORM: SiteFormData = {
  name: '',
  slug: '',
  primary_domain: '',
  active: true,
  published: false,
  logo_url: '',
  primary_color: '#7C3AED',
  accent_color: '#9333EA',
  font_family: 'Inter',
  contact_phone: '',
  contact_whatsapp: '',
  contact_email: '',
  contact_address: '',
  seo_title: '',
  seo_description: '',
  gtm_id: '',
  ga4_measurement_id: '',
  facebook_pixel_id: '',
  lead_pipeline_id: null,
  lead_stage_id: null,
  lead_label_id: null,
};

const EMPTY_PAGE_FORM: PageFormData = {
  title: '',
  slug: '',
  content: '',
  active: true,
  in_menu: true,
  menu_position: 0,
};

const EMPTY_ARTICLE_FORM: ArticleFormData = {
  title: '',
  content: '',
  excerpt: '',
  cover_image_url: '',
};

function formatDate(iso: string) {
  return formatDateBR(iso);
}

export default function SiteBuilder() {
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('portal');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Site form
  const [siteForm, setSiteForm] = useState<SiteFormData>(EMPTY_SITE_FORM);
  const [siteFormDirty, setSiteFormDirty] = useState(false);

  // Logo upload + extração de cores (determinística, canvas)
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Preencher com IA (proposta — o usuário revisa e salva)
  const [aiText, setAiText] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiAboutHtml, setAiAboutHtml] = useState<string | null>(null);

  // Pages
  const [pages, setPages] = useState<SitePage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pageModal, setPageModal] = useState(false);
  const [editingPage, setEditingPage] = useState<SitePage | null>(null);
  const [pageForm, setPageForm] = useState<PageFormData>(EMPTY_PAGE_FORM);

  // Articles
  const [articles, setArticles] = useState<SiteArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articleModal, setArticleModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<SiteArticle | null>(null);
  const [articleForm, setArticleForm] = useState<ArticleFormData>(EMPTY_ARTICLE_FORM);

  // Leads
  const [leads, setLeads] = useState<SiteLead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsStatusFilter, setLeadsStatusFilter] = useState('');

  const loadSite = useCallback(async () => {
    setLoading(true);
    try {
      const sites = await siteBuilderService.listSites();
      if (sites.length > 0) {
        setSite(sites[0]);
        const s = sites[0];
        setSiteForm({
          name: s.name,
          slug: s.slug,
          primary_domain: s.primary_domain ?? '',
          active: s.active,
          published: s.published,
          logo_url: s.branding.logo_url ?? '',
          primary_color: s.branding.primary_color ?? '#7C3AED',
          accent_color: s.branding.accent_color ?? '#9333EA',
          font_family: s.branding.font_family ?? 'Inter',
          contact_phone: s.contact.phone ?? '',
          contact_whatsapp: s.contact.whatsapp ?? '',
          contact_email: s.contact.email ?? '',
          contact_address: s.contact.address ?? '',
          seo_title: s.seo.title ?? '',
          seo_description: s.seo.description ?? '',
          gtm_id: s.tracking.gtm_id ?? '',
          ga4_measurement_id: s.tracking.ga4_measurement_id ?? '',
          facebook_pixel_id: s.tracking.facebook_pixel_id ?? '',
          lead_pipeline_id: s.lead_pipeline_id ?? null,
          lead_stage_id: s.lead_stage_id ?? null,
          lead_label_id: s.lead_label_id ?? null,
        });
      }
    } catch {
      toast.error('Erro ao carregar site');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPages = useCallback(async () => {
    if (!site) return;
    setPagesLoading(true);
    try {
      setPages(await siteBuilderService.listPages(site.id));
    } catch {
      toast.error('Erro ao carregar páginas');
    } finally {
      setPagesLoading(false);
    }
  }, [site]);

  const loadArticles = useCallback(async () => {
    if (!site) return;
    setArticlesLoading(true);
    try {
      setArticles(await siteBuilderService.listArticles(site.id));
    } catch {
      toast.error('Erro ao carregar artigos');
    } finally {
      setArticlesLoading(false);
    }
  }, [site]);

  const loadLeads = useCallback(async (statusFilter?: string) => {
    if (!site) return;
    setLeadsLoading(true);
    try {
      const params: { status?: string; per_page: number } = { per_page: 50 };
      if (statusFilter) params.status = statusFilter;
      const result = await siteBuilderService.listLeads(site.id, params);
      setLeads(result.data);
      setLeadsTotal(result.meta.total);
    } catch {
      toast.error('Erro ao carregar leads');
    } finally {
      setLeadsLoading(false);
    }
  }, [site]);

  useEffect(() => { loadSite(); }, [loadSite]);
  useEffect(() => {
    if (site && activeTab === 'pages') loadPages();
    if (site && activeTab === 'articles') loadArticles();
    if (site && activeTab === 'leads') loadLeads(leadsStatusFilter || undefined);
  }, [site, activeTab, loadPages, loadArticles, loadLeads, leadsStatusFilter]);

  const handleSaveSite = async () => {
    setSaving(true);
    try {
      if (site) {
        const updated = await siteBuilderService.updateSite(site.id, siteForm);
        setSite(updated);
        toast.success('Site atualizado');
      } else {
        const created = await siteBuilderService.createSite(siteForm);
        setSite(created);
        toast.success('Site criado');
      }
      setSiteFormDirty(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar site'));
    } finally {
      setSaving(false);
    }
  };

  const setF = (field: Partial<SiteFormData>) => {
    setSiteForm(prev => ({ ...prev, ...field }));
    setSiteFormDirty(true);
  };

  // Sobe a logo E extrai as cores dela (canvas local, sem IA): preenche
  // logo_url + cor primária/destaque de uma vez. Usuário revisa e salva.
  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (logoInputRef.current) logoInputRef.current.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Logo muito grande (máx 8MB).'); return; }

    setLogoUploading(true);
    try {
      // Cores primeiro (arquivo local — funciona mesmo se o upload falhar).
      const colors = await extractLogoColors(file);
      const { url } = await siteBuilderService.uploadAsset(file);
      setF({
        logo_url: url,
        ...(colors ? { primary_color: colors.primary, accent_color: colors.accent } : {}),
      });
      toast.success(colors
        ? `Logo no ar. Cores extraídas: ${colors.primary} / ${colors.accent} — revise e salve.`
        : 'Logo no ar. Não achei cor de marca na imagem (P&B?) — cores mantidas.');
    } catch {
      toast.error('Falha no upload da logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  // IA lê o material colado e devolve os campos NOS LUGARES CERTOS do form.
  // Nada é salvo sozinho: o form fica sujo e o usuário revisa + salva.
  const handleAiSetup = async () => {
    if (!site) { toast.error('Crie o site primeiro (aba Configurações).'); return; }
    if (aiText.trim().length < 40) { toast.error('Cole um material com mais contexto (mín. 40 caracteres).'); return; }
    setAiRunning(true);
    try {
      const p = await siteBuilderService.aiSetup(site.id, aiText.trim());
      const patch: Partial<SiteFormData> = {};
      if (p.name) patch.name = p.name;
      if (p.seo_title) patch.seo_title = p.seo_title;
      if (p.seo_description) patch.seo_description = p.seo_description;
      if (p.contact_phone) patch.contact_phone = p.contact_phone;
      if (p.contact_whatsapp) patch.contact_whatsapp = p.contact_whatsapp;
      if (p.contact_email) patch.contact_email = p.contact_email;
      if (p.contact_address) patch.contact_address = p.contact_address;
      const filled = Object.keys(patch).length;
      if (filled === 0 && !p.about_html) {
        toast.error('A IA não achou dados utilizáveis nesse material.');
        return;
      }
      setF(patch);
      setAiAboutHtml(p.about_html ?? null);
      toast.success(`${filled} campo${filled !== 1 ? 's' : ''} preenchido${filled !== 1 ? 's' : ''}. Revise e clique em Salvar.`);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'IA falhou ao interpretar o material.'));
    } finally {
      setAiRunning(false);
    }
  };

  // Cria a página "Sobre nós" com o HTML proposto pela IA (clique explícito).
  const handleCreateAboutPage = async () => {
    if (!site || !aiAboutHtml) return;
    setSaving(true);
    try {
      await siteBuilderService.createPage(site.id, {
        title: 'Sobre nós',
        slug: 'sobre-nos',
        content: aiAboutHtml,
        active: true,
        in_menu: true,
        menu_position: 99,
      });
      toast.success('Página "Sobre nós" criada (aba Páginas).');
      setAiAboutHtml(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Falha ao criar a página.'));
    } finally {
      setSaving(false);
    }
  };

  // Pages handlers
  const openCreatePage = () => {
    setEditingPage(null);
    setPageForm(EMPTY_PAGE_FORM);
    setPageModal(true);
  };

  const openEditPage = (page: SitePage) => {
    setEditingPage(page);
    setPageForm({
      title: page.title,
      slug: page.slug,
      content: page.content ?? '',
      active: page.active,
      in_menu: page.in_menu,
      menu_position: page.menu_position ?? 0,
    });
    setPageModal(true);
  };

  const handleSavePage = async () => {
    if (!site || !pageForm.title.trim()) { toast.error('Título é obrigatório'); return; }
    setSaving(true);
    try {
      if (editingPage) {
        const updated = await siteBuilderService.updatePage(site.id, editingPage.id, pageForm);
        setPages(prev => prev.map(p => p.id === updated.id ? updated : p));
        toast.success('Página atualizada');
      } else {
        const created = await siteBuilderService.createPage(site.id, pageForm);
        setPages(prev => [...prev, created]);
        toast.success('Página criada');
      }
      setPageModal(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar página'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (page: SitePage) => {
    if (!site) return;
    try {
      await siteBuilderService.deletePage(site.id, page.id);
      setPages(prev => prev.filter(p => p.id !== page.id));
      toast.success('Página removida');
    } catch {
      toast.error('Erro ao remover página');
    }
  };

  // Articles handlers
  const openCreateArticle = () => {
    setEditingArticle(null);
    setArticleForm(EMPTY_ARTICLE_FORM);
    setArticleModal(true);
  };

  const openEditArticle = (article: SiteArticle) => {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      content: article.content ?? '',
      excerpt: article.excerpt ?? '',
      cover_image_url: article.cover_image_url ?? '',
    });
    setArticleModal(true);
  };

  const handleSaveArticle = async () => {
    if (!site || !articleForm.title.trim()) { toast.error('Título é obrigatório'); return; }
    setSaving(true);
    try {
      if (editingArticle) {
        const updated = await siteBuilderService.updateArticle(site.id, editingArticle.id, articleForm);
        setArticles(prev => prev.map(a => a.id === updated.id ? updated : a));
        toast.success('Artigo atualizado');
      } else {
        const created = await siteBuilderService.createArticle(site.id, articleForm);
        setArticles(prev => [...prev, created]);
        toast.success('Artigo criado');
      }
      setArticleModal(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar artigo'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublishArticle = async (article: SiteArticle) => {
    if (!site) return;
    try {
      const updated = await siteBuilderService.publishArticle(site.id, article.id);
      setArticles(prev => prev.map(a => a.id === updated.id ? updated : a));
      toast.success('Artigo publicado');
    } catch {
      toast.error('Erro ao publicar artigo');
    }
  };

  const handleArchiveArticle = async (article: SiteArticle) => {
    if (!site) return;
    try {
      const updated = await siteBuilderService.archiveArticle(site.id, article.id);
      setArticles(prev => prev.map(a => a.id === updated.id ? updated : a));
      toast.success('Artigo arquivado');
    } catch {
      toast.error('Erro ao arquivar artigo');
    }
  };

  const handleDeleteArticle = async (article: SiteArticle) => {
    if (!site) return;
    try {
      await siteBuilderService.deleteArticle(site.id, article.id);
      setArticles(prev => prev.filter(a => a.id !== article.id));
      toast.success('Artigo removido');
    } catch {
      toast.error('Erro ao remover artigo');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Carregando site...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Site Builder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {site
              ? <>Site: <strong>{site.name}</strong> — /{site.slug}</>
              : 'Nenhum site configurado ainda'
            }
          </p>
        </div>
        {site && (
          <div className="flex items-center gap-2">
            <Badge className={site.published
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }>
              {site.published ? 'Publicado' : 'Rascunho'}
            </Badge>
            {site.primary_domain && (
              <a
                href={`https://${site.primary_domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Visualizar
              </a>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Portal tab */}
      {activeTab === 'portal' && (() => {
        const portalUrl = `${window.location.origin}/portal/${getTenantSlug() ?? site?.slug ?? ''}`;
        const brand = site?.branding.primary_color || '#0E7C5A';
        const copyLink = () => {
          navigator.clipboard?.writeText(portalUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        };
        return (
          <div className="space-y-6">
            {/* Template escolhido */}
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl text-white" style={{ background: brand }}>
                    <LayoutTemplate className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">Portal Imobiliário</h2>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Ativo</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Template <strong>Moderno (Editorial)</strong> — o site público da imobiliária, com a sua marca e os seus imóveis.
                    </p>
                  </div>
                </div>
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ background: brand }}
                >
                  <ExternalLink className="h-4 w-4" /> Ver portal
                </a>
              </div>

              {/* Link público */}
              <div className="border-t border-border bg-muted/30 p-5">
                <UILabel className="text-xs text-muted-foreground">Link público do portal</UILabel>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input readOnly value={portalUrl} className="flex-1 font-mono text-sm" />
                  <Button variant="outline" size="sm" onClick={copyLink} className="flex-none">
                    {copied ? <><Check className="mr-1 h-4 w-4 text-emerald-600" /> Copiado</> : <><Copy className="mr-1 h-4 w-4" /> Copiar</>}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Indexável no Google. Depois dá pra apontar um domínio próprio na aba Configurações.
                </p>
              </div>
            </section>

            {/* O que o portal faz */}
            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-base font-semibold">O que já vem pronto</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Home, title: 'Home com busca', desc: 'Vitrine dos imóveis com busca por tipo, bairro, cidade e dormitórios.' },
                  { icon: Building2, title: 'Página de cada imóvel', desc: 'Gerada sozinha de cada imóvel publicado — galeria, ficha, mapa. Indexável.' },
                  { icon: MessageCircle, title: 'Contato via WhatsApp', desc: 'Botão de WhatsApp em cada imóvel e captura de lead direto no seu CRM.' },
                  { icon: Search, title: 'SEO da sua marca', desc: 'Usa sua logo, cores e conteúdo (editáveis na aba Configurações).' },
                ].map((f) => (
                  <div key={f.title} className="flex gap-3">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg" style={{ background: `${brand}1a`, color: brand }}>
                      <f.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{f.title}</div>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveTab('config')}>
                  <Edit className="mr-1.5 h-4 w-4" /> Editar marca e SEO
                </Button>
                <a href="/properties" className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                  <Building2 className="mr-1.5 h-4 w-4" /> Gerenciar imóveis
                </a>
              </div>
            </section>
          </div>
        );
      })()}

      {/* Config tab */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Preencher com IA */}
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Preencher com IA
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Cole a apresentação da imobiliária (texto do Instagram, sobre-nós, documento institucional).
              A IA distribui as informações nos campos certos abaixo — nome, SEO, contato e página Sobre.
              Nada é salvo sozinho: você revisa e clica em Salvar.
            </p>
            <Textarea
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              rows={4}
              placeholder="Ex: A Imobiliária XYZ atua há 15 anos em Campinas com foco em lançamentos... Fale com a gente no (19) 99999-9999 ou contato@xyz.com.br"
              className="resize-none bg-background"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button onClick={handleAiSetup} disabled={aiRunning || !site}>
                {aiRunning
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Interpretando...</>
                  : <><Sparkles className="mr-1.5 h-4 w-4" /> Preencher campos</>}
              </Button>
              {aiAboutHtml && (
                <Button variant="outline" onClick={handleCreateAboutPage} disabled={saving}>
                  <FileText className="mr-1.5 h-4 w-4" /> Criar página "Sobre nós" com o texto gerado
                </Button>
              )}
              {!site && (
                <span className="text-xs text-muted-foreground">Crie o site primeiro (preencha o nome e salve).</span>
              )}
            </div>
          </section>

          {/* Basic */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold mb-4">Informações básicas</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <UILabel>Nome do site *</UILabel>
                <Input value={siteForm.name} onChange={e => setF({ name: e.target.value })}
                  placeholder="Imobiliária XYZ" className="mt-1" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <UILabel>Slug (URL base)</UILabel>
                <Input value={siteForm.slug} onChange={e => setF({ slug: e.target.value })}
                  placeholder="imobiliaria-xyz" className="mt-1 font-mono" />
              </div>
              <div className="col-span-2">
                <UILabel>Domínio principal</UILabel>
                <Input value={siteForm.primary_domain ?? ''} onChange={e => setF({ primary_domain: e.target.value })}
                  placeholder="www.minhaImobiliaria.com.br" className="mt-1" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="active" checked={siteForm.active}
                  onChange={e => setF({ active: e.target.checked })} className="rounded" />
                <UILabel htmlFor="active" className="cursor-pointer">Ativo</UILabel>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="published" checked={siteForm.published}
                  onChange={e => setF({ published: e.target.checked })} className="rounded" />
                <UILabel htmlFor="published" className="cursor-pointer">Publicado</UILabel>
              </div>
            </div>
          </section>

          {/* Branding */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold mb-4">Identidade visual</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <UILabel>Logo</UILabel>
                <div className="mt-1 flex items-center gap-2">
                  {siteForm.logo_url && (
                    <img src={siteForm.logo_url} alt="logo"
                      className="h-9 w-9 rounded border border-border object-contain bg-white flex-none"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <Input value={siteForm.logo_url ?? ''} onChange={e => setF({ logo_url: e.target.value })}
                    placeholder="https://... ou envie o arquivo" className="flex-1" />
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                  <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading} className="flex-none">
                    {logoUploading
                      ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...</>
                      : <><Upload className="mr-1.5 h-4 w-4" /> Enviar logo</>}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ao enviar a logo, as cores da marca abaixo são extraídas dela automaticamente.
                </p>
              </div>
              <div>
                <UILabel>Cor primária</UILabel>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={siteForm.primary_color ?? '#7C3AED'}
                    onChange={e => setF({ primary_color: e.target.value })}
                    className="h-9 w-14 rounded border border-input cursor-pointer" />
                  <Input value={siteForm.primary_color ?? ''} onChange={e => setF({ primary_color: e.target.value })}
                    placeholder="#7C3AED" className="font-mono flex-1" />
                </div>
              </div>
              <div>
                <UILabel>Cor de destaque</UILabel>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={siteForm.accent_color ?? '#9333EA'}
                    onChange={e => setF({ accent_color: e.target.value })}
                    className="h-9 w-14 rounded border border-input cursor-pointer" />
                  <Input value={siteForm.accent_color ?? ''} onChange={e => setF({ accent_color: e.target.value })}
                    placeholder="#9333EA" className="font-mono flex-1" />
                </div>
              </div>
              <div className="col-span-2">
                <UILabel htmlFor="site-font">Fonte</UILabel>
                <select
                  id="site-font"
                  value={siteForm.font_family ?? 'Inter'}
                  onChange={e => setF({ font_family: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  style={{ fontFamily: `${siteForm.font_family ?? 'Inter'}, system-ui, sans-serif` }}
                >
                  {SITE_FONTS.map(f => (
                    <option key={f} value={f} style={{ fontFamily: `${f}, system-ui, sans-serif` }}>{f}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aplica-se a textos e títulos do site público.
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold mb-4">Contato</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'contact_phone', label: 'Telefone', placeholder: '(11) 9999-9999' },
                { key: 'contact_whatsapp', label: 'WhatsApp', placeholder: '5511999999999' },
                { key: 'contact_email', label: 'E-mail', placeholder: 'contato@...' },
              ].map(f => (
                <div key={f.key}>
                  <UILabel>{f.label}</UILabel>
                  <Input
                    value={(siteForm as unknown as Record<string, string>)[f.key] ?? ''}
                    onChange={e => setF({ [f.key]: e.target.value } as Partial<SiteFormData>)}
                    placeholder={f.placeholder}
                    className="mt-1"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <UILabel>Endereço</UILabel>
                <Input value={siteForm.contact_address ?? ''} onChange={e => setF({ contact_address: e.target.value })}
                  placeholder="Rua..." className="mt-1" />
              </div>
            </div>
          </section>

          {/* Roteamento de leads: pra onde vão os leads capturados nos formulários
              do site. Sem pipeline = cai no pipeline padrão do tenant (comportamento
              antigo). A tag do imóvel (cadastro do imóvel) é aplicada por cima desta. */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold mb-1">Roteamento de leads</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Escolha o pipeline, a coluna e a tag de destino dos leads que se cadastram
              nos formulários do site. Deixe o pipeline vazio para usar o pipeline padrão.
            </p>
            <LeadRoutingFields
              value={{
                lead_pipeline_id: siteForm.lead_pipeline_id ?? null,
                lead_stage_id: siteForm.lead_stage_id ?? null,
                lead_label_id: siteForm.lead_label_id ?? null,
              }}
              onChange={patch => setF(patch)}
            />
          </section>

          {/* SEO */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold mb-4">SEO</h2>
            <div className="space-y-3">
              <div>
                <UILabel>Título SEO</UILabel>
                <Input value={siteForm.seo_title ?? ''} onChange={e => setF({ seo_title: e.target.value })}
                  placeholder="Imobiliária XYZ — Venda e locação de imóveis" className="mt-1" />
              </div>
              <div>
                <UILabel>Meta description</UILabel>
                <Textarea value={siteForm.seo_description ?? ''} onChange={e => setF({ seo_description: e.target.value })}
                  placeholder="Encontre o imóvel ideal..." rows={2} className="mt-1 resize-none" />
              </div>
            </div>
          </section>

          {/* Tracking */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold mb-4">Rastreamento</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'gtm_id', label: 'Google Tag Manager ID', placeholder: 'GTM-XXXXXX' },
                { key: 'ga4_measurement_id', label: 'GA4 Measurement ID', placeholder: 'G-XXXXXXXXXX' },
                { key: 'facebook_pixel_id', label: 'Meta Pixel ID', placeholder: '1234567890' },
              ].map(f => (
                <div key={f.key}>
                  <UILabel>{f.label}</UILabel>
                  <Input
                    value={(siteForm as unknown as Record<string, string>)[f.key] ?? ''}
                    onChange={e => setF({ [f.key]: e.target.value } as Partial<SiteFormData>)}
                    placeholder={f.placeholder}
                    className="mt-1 font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={handleSaveSite} disabled={saving || !siteFormDirty && !!site}>
              {saving ? 'Salvando...' : site ? 'Salvar alterações' : 'Criar site'}
            </Button>
          </div>
        </div>
      )}

      {/* Pages tab */}
      {activeTab === 'pages' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{pages.length} página{pages.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={openCreatePage} disabled={!site}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nova página
            </Button>
          </div>

          {!site ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Configure o site primeiro na aba Configurações
            </div>
          ) : pagesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />Carregando...
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma página criada</p>
              <Button size="sm" className="mt-3" onClick={openCreatePage}>
                <Plus className="h-4 w-4 mr-1" />
                Criar primeira página
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {pages.map(page => (
                <div key={page.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{page.title}</span>
                      {page.in_menu && (
                        <Badge variant="secondary" className="text-xs">Menu</Badge>
                      )}
                      {!page.active && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Inativa</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">/{page.slug} · Criada {formatDate(page.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditPage(page)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeletePage(page)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Articles tab */}
      {activeTab === 'articles' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{articles.length} artigo{articles.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={openCreateArticle} disabled={!site}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo artigo
            </Button>
          </div>

          {!site ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Configure o site primeiro
            </div>
          ) : articlesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />Carregando...
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Newspaper className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhum artigo criado</p>
              <Button size="sm" className="mt-3" onClick={openCreateArticle}>
                <Plus className="h-4 w-4 mr-1" />
                Criar primeiro artigo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map(article => (
                <div key={article.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
                  {article.cover_image_url && (
                    <img src={article.cover_image_url} alt=""
                      className="h-14 w-20 object-cover rounded flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{article.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${ARTICLE_STATUS_COLORS[article.status] ?? ''}`}>
                        {ARTICLE_STATUS_LABELS[article.status] ?? article.status}
                      </span>
                    </div>
                    {article.excerpt && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{article.excerpt}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {article.published_at ? `Publicado ${formatDate(article.published_at)}` : `Criado ${formatDate(article.created_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {article.status === 'draft' && (
                      <Button variant="ghost" size="icon" title="Publicar"
                        onClick={() => handlePublishArticle(article)}>
                        <Send className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                    {article.status === 'published' && (
                      <Button variant="ghost" size="icon" title="Arquivar"
                        onClick={() => handleArchiveArticle(article)}>
                        <Archive className="h-4 w-4 text-orange-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEditArticle(article)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteArticle(article)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leads tab */}
      {activeTab === 'leads' && (
        <div>
          {/* Status filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {['', 'received', 'contacted', 'converted', 'lost', 'spam'].map(s => (
              <button
                key={s}
                onClick={() => setLeadsStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  leadsStatusFilter === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === '' ? `Todos (${leadsTotal})` : SITE_LEAD_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {!site ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Configure o site primeiro
            </div>
          ) : leadsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />Carregando...
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhum lead capturado ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map(lead => (
                <div key={lead.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{lead.name ?? '—'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${SITE_LEAD_STATUS_COLORS[lead.status] ?? ''}`}>
                        {SITE_LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                      </span>
                      {lead.source && (
                        <span className="text-xs text-muted-foreground">via {lead.source}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {lead.email && (
                        <span className="text-xs text-muted-foreground">{lead.email}</span>
                      )}
                      {lead.phone && (
                        <span className="text-xs text-muted-foreground">{lead.phone}</span>
                      )}
                    </div>
                    {lead.message && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lead.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(lead.created_at)}
                      {lead.utm_campaign && ` · campanha: ${lead.utm_campaign}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Page modal */}
      <Dialog open={pageModal} onOpenChange={setPageModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPage ? 'Editar página' : 'Nova página'}</DialogTitle>
            <DialogDescription>Configure o conteúdo e as opções desta página</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <UILabel>Título *</UILabel>
              <Input value={pageForm.title}
                onChange={e => setPageForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Sobre nós" className="mt-1" />
            </div>
            <div>
              <UILabel>Slug (URL)</UILabel>
              <Input value={pageForm.slug ?? ''}
                onChange={e => setPageForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="sobre-nos" className="mt-1 font-mono" />
            </div>
            <div>
              <UILabel>Conteúdo (HTML)</UILabel>
              <Textarea value={pageForm.content ?? ''}
                onChange={e => setPageForm(f => ({ ...f, content: e.target.value }))}
                rows={5} placeholder="<h1>...</h1>" className="mt-1 font-mono text-xs resize-none" />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="page_active" checked={pageForm.active ?? true}
                  onChange={e => setPageForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
                <UILabel htmlFor="page_active" className="cursor-pointer">Ativa</UILabel>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="page_menu" checked={pageForm.in_menu ?? true}
                  onChange={e => setPageForm(f => ({ ...f, in_menu: e.target.checked }))} className="rounded" />
                <UILabel htmlFor="page_menu" className="cursor-pointer">Exibir no menu</UILabel>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageModal(false)}>Cancelar</Button>
            <Button onClick={handleSavePage} disabled={saving}>
              {saving ? 'Salvando...' : editingPage ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Article modal */}
      <Dialog open={articleModal} onOpenChange={setArticleModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Editar artigo' : 'Novo artigo'}</DialogTitle>
            <DialogDescription>Escreva o conteúdo do artigo para o blog do site</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <UILabel>Título *</UILabel>
              <Input value={articleForm.title}
                onChange={e => setArticleForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Como financiar um imóvel?" className="mt-1" />
            </div>
            <div>
              <UILabel>Capa (URL da imagem)</UILabel>
              <Input value={articleForm.cover_image_url ?? ''}
                onChange={e => setArticleForm(f => ({ ...f, cover_image_url: e.target.value }))}
                placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <UILabel>Resumo</UILabel>
              <Textarea value={articleForm.excerpt ?? ''}
                onChange={e => setArticleForm(f => ({ ...f, excerpt: e.target.value }))}
                rows={2} placeholder="Breve descrição exibida na listagem..." className="mt-1 resize-none" />
            </div>
            <div>
              <UILabel>Conteúdo</UILabel>
              <Textarea value={articleForm.content ?? ''}
                onChange={e => setArticleForm(f => ({ ...f, content: e.target.value }))}
                rows={10} placeholder="Conteúdo completo do artigo..." className="mt-1 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveArticle} disabled={saving}>
              {saving ? 'Salvando...' : editingArticle ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
