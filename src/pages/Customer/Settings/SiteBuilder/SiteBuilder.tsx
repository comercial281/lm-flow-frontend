import { useState, useEffect, useCallback } from 'react';
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
} from '@evoapi/design-system';
import {
  Globe, Plus, Edit, Trash2, FileText, Newspaper,
  ExternalLink, Eye, EyeOff, Archive, Send, RefreshCw,
} from 'lucide-react';
import {
  siteBuilderService,
  Site,
  SitePage,
  SiteArticle,
  SiteFormData,
  PageFormData,
  ArticleFormData,
  ARTICLE_STATUS_LABELS,
  ARTICLE_STATUS_COLORS,
} from '@/services/siteBuilder/siteBuilderService';

const TABS = [
  { key: 'config', label: 'Configurações', icon: Globe },
  { key: 'pages', label: 'Páginas', icon: FileText },
  { key: 'articles', label: 'Artigos', icon: Newspaper },
];

const EMPTY_SITE_FORM: SiteFormData = {
  name: '',
  slug: '',
  primary_domain: '',
  active: true,
  published: false,
  logo_url: '',
  primary_color: '#7C3AED',
  accent_color: '#9333EA',
  contact_phone: '',
  contact_whatsapp: '',
  contact_email: '',
  contact_address: '',
  seo_title: '',
  seo_description: '',
  gtm_id: '',
  ga4_measurement_id: '',
  facebook_pixel_id: '',
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
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function SiteBuilder() {
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('config');
  const [saving, setSaving] = useState(false);

  // Site form
  const [siteForm, setSiteForm] = useState<SiteFormData>(EMPTY_SITE_FORM);
  const [siteFormDirty, setSiteFormDirty] = useState(false);

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
          contact_phone: s.contact.phone ?? '',
          contact_whatsapp: s.contact.whatsapp ?? '',
          contact_email: s.contact.email ?? '',
          contact_address: s.contact.address ?? '',
          seo_title: s.seo.title ?? '',
          seo_description: s.seo.description ?? '',
          gtm_id: s.tracking.gtm_id ?? '',
          ga4_measurement_id: s.tracking.ga4_measurement_id ?? '',
          facebook_pixel_id: s.tracking.facebook_pixel_id ?? '',
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

  useEffect(() => { loadSite(); }, [loadSite]);
  useEffect(() => {
    if (site && activeTab === 'pages') loadPages();
    if (site && activeTab === 'articles') loadArticles();
  }, [site, activeTab, loadPages, loadArticles]);

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
    } catch {
      toast.error('Erro ao salvar site');
    } finally {
      setSaving(false);
    }
  };

  const setF = (field: Partial<SiteFormData>) => {
    setSiteForm(prev => ({ ...prev, ...field }));
    setSiteFormDirty(true);
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
    } catch {
      toast.error('Erro ao salvar página');
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
    } catch {
      toast.error('Erro ao salvar artigo');
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

      {/* Config tab */}
      {activeTab === 'config' && (
        <div className="space-y-6">
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
                <UILabel>Logo URL</UILabel>
                <Input value={siteForm.logo_url ?? ''} onChange={e => setF({ logo_url: e.target.value })}
                  placeholder="https://..." className="mt-1" />
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
                    value={(siteForm as Record<string, string>)[f.key] ?? ''}
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
                    value={(siteForm as Record<string, string>)[f.key] ?? ''}
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
                        <Archive className="h-4 w-4 text-amber-600" />
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
