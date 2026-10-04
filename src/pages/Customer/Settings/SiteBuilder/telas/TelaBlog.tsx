import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import {
  Archive, Edit, Image as ImageIcon, Lightbulb, Loader2, Newspaper, Plus, RefreshCw, Send, Trash2, X,
} from 'lucide-react';
import { formatDateBR } from '@/utils/dateUtils';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { RichTextEditor, type RichTextEditorRef } from '@/components/chat/rich-text-editor';
import {
  siteBuilderService, ARTICLE_STATUS_COLORS, ARTICLE_STATUS_LABELS,
  type ArticleFormData, type Site, type SiteArticle,
} from '@/services/siteBuilder/siteBuilderService';
import { CampoTexto, CampoTextoLongo } from '../ui/Campo';

const EMPTY_ARTICLE_FORM: ArticleFormData = {
  title: '',
  body_html: '',
  excerpt: '',
  cover_image_url: '',
};

// Sugestões prontas de pauta (nicho imobiliário) — clicar preenche o título.
const ARTICLE_IDEAS = [
  'Como financiar um imóvel: passo a passo',
  'Documentos necessários para comprar um imóvel',
  'Vale a pena alugar ou comprar? Como decidir',
  'Dicas para valorizar seu imóvel antes de vender',
  'O que avaliar antes de comprar o primeiro apê',
  'Financiamento pela Caixa: como funciona',
  'Erros comuns na hora de alugar um imóvel',
  'Como funciona o processo de compra na planta',
  'Bairros em alta na região: onde investir',
  'Checklist de vistoria antes de assinar o contrato',
];

export default function TelaBlog({ site }: { site: Site }) {
  // Articles
  const [articles, setArticles] = useState<SiteArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articleModal, setArticleModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<SiteArticle | null>(null);
  const [articleForm, setArticleForm] = useState<ArticleFormData>(EMPTY_ARTICLE_FORM);
  const [articleLoadingBody, setArticleLoadingBody] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const articleEditorRef = useRef<RichTextEditorRef>(null);
  // Semente do editor: (re)carrega o HTML no editor a cada abertura do modal.
  const [editorSeed, setEditorSeed] = useState({ html: '', nonce: 0 });
  const [saving, setSaving] = useState(false);

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

  useEffect(() => { loadArticles(); }, [loadArticles]);

  // (Re)injeta o HTML no editor sempre que o modal abre ou o corpo é carregado.
  // O editor prosemirror lida com HTML via setContent (o `value` só trata texto).
  useEffect(() => {
    if (!articleModal) return;
    articleEditorRef.current?.setContent(editorSeed.html || '');
  }, [articleModal, editorSeed.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Articles handlers
  const openCreateArticle = () => {
    setEditingArticle(null);
    setArticleForm(EMPTY_ARTICLE_FORM);
    setEditorSeed(s => ({ html: '', nonce: s.nonce + 1 }));
    setArticleModal(true);
  };

  const openEditArticle = async (article: SiteArticle) => {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      body_html: article.body_html ?? '',
      excerpt: article.excerpt ?? '',
      cover_image_url: article.cover_image_url ?? '',
    });
    setEditorSeed(s => ({ html: article.body_html ?? '', nonce: s.nonce + 1 }));
    setArticleModal(true);
    // A listagem não traz o corpo; busca o artigo completo e recarrega o editor.
    if (!site) return;
    setArticleLoadingBody(true);
    try {
      const full = await siteBuilderService.getArticle(site.id, article.id);
      setArticleForm(f => ({ ...f, body_html: full.body_html ?? '', excerpt: full.excerpt ?? f.excerpt }));
      setEditorSeed(s => ({ html: full.body_html ?? '', nonce: s.nonce + 1 }));
    } catch {
      toast.error('Erro ao carregar o conteúdo do artigo');
    } finally {
      setArticleLoadingBody(false);
    }
  };

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (coverInputRef.current) coverInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Envie um arquivo de imagem.'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Imagem muito grande (máx 8MB).'); return; }
    setCoverUploading(true);
    try {
      const { url } = await siteBuilderService.uploadAsset(file);
      setArticleForm(f => ({ ...f, cover_image_url: url }));
      toast.success('Capa enviada.');
    } catch {
      toast.error('Falha no upload da capa.');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleSaveArticle = async () => {
    if (!site || !articleForm.title.trim()) { toast.error('Título é obrigatório'); return; }
    // O editor é a fonte da verdade do corpo (HTML serializado via ref).
    const payload: ArticleFormData = {
      ...articleForm,
      body_html: articleEditorRef.current?.getContent() ?? articleForm.body_html ?? '',
    };
    setSaving(true);
    try {
      if (editingArticle) {
        const updated = await siteBuilderService.updateArticle(site.id, editingArticle.id, payload);
        setArticles(prev => prev.map(a => a.id === updated.id ? updated : a));
        toast.success('Artigo atualizado');
      } else {
        const created = await siteBuilderService.createArticle(site.id, payload);
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

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{articles.length} artigo{articles.length !== 1 ? 's' : ''}</p>
          <Button size="sm" onClick={openCreateArticle}>
            <Plus className="h-4 w-4 mr-1.5" />
            Novo artigo
          </Button>
        </div>

        {articlesLoading ? (
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
                    {article.published_at ? `Publicado ${formatDateBR(article.published_at)}` : `Criado ${formatDateBR(article.created_at)}`}
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
                  <Button variant="ghost" size="icon" onClick={() => openEditArticle(article)} aria-label="Editar artigo" title="Editar artigo">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteArticle(article)}
                    aria-label="Excluir artigo"
                    title="Excluir artigo">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Article modal */}
      <Dialog open={articleModal} onOpenChange={setArticleModal}>
        <DialogContent size="wide" className="sm:max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArticle ? 'Editar artigo' : 'Novo artigo'}</DialogTitle>
            <DialogDescription>Escreva o conteúdo do artigo para o blog do site</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2 md:grid-cols-[1fr_260px]">
            {/* Coluna principal — formulário */}
            <div className="space-y-5 min-w-0">
              <CampoTexto id="artigo-titulo" rotulo="Título *" valor={articleForm.title}
                placeholder="Ex: Como financiar um imóvel?"
                ajuda="Aparece no topo do artigo e na lista do blog. Também é o que o Google mostra."
                aoMudar={title => setArticleForm(f => ({ ...f, title }))} />

              <div className="space-y-2">
                <p className="text-sm font-medium">Capa</p>
                <p className="text-sm text-muted-foreground">A foto do topo do artigo e da lista do blog.</p>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
                {articleForm.cover_image_url ? (
                  <div className="relative w-full overflow-hidden rounded-lg border border-border">
                    <img src={articleForm.cover_image_url} alt="Capa"
                      className="h-40 w-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute right-2 top-2 flex gap-1.5">
                      <Button type="button" size="sm" variant="secondary"
                        onClick={() => coverInputRef.current?.click()} disabled={coverUploading}>
                        {coverUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Trocar'}
                      </Button>
                      <Button type="button" size="icon" variant="secondary"
                        onClick={() => setArticleForm(f => ({ ...f, cover_image_url: '' }))} title="Remover capa">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => coverInputRef.current?.click()} disabled={coverUploading}
                    className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
                    {coverUploading
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> Enviando...</>
                      : <><ImageIcon className="h-6 w-6" /> <span className="text-sm">Enviar imagem de capa</span></>}
                  </button>
                )}
              </div>

              <CampoTextoLongo id="artigo-resumo" rotulo="Resumo" valor={articleForm.excerpt ?? ''}
                rows={2} placeholder="Breve descrição exibida na listagem..." classeDoControle="resize-none"
                ajuda="Duas linhas que aparecem embaixo do título, na lista de artigos do blog."
                aoMudar={excerpt => setArticleForm(f => ({ ...f, excerpt }))} />

              <div className="space-y-2">
                <p className="text-sm font-medium">Conteúdo</p>
                <div className="relative">
                  <RichTextEditor ref={articleEditorRef} showToolbar
                    placeholder="Escreva o conteúdo do artigo... (use a barra para negrito, itálico e listas)" />
                  {articleLoadingBody && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando conteúdo...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coluna lateral — sugestões de pauta */}
            <aside className="md:border-l md:border-border md:pl-5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Lightbulb className="h-4 w-4 text-amber-500" /> Ideias de artigo
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Clique para usar como título e comece a escrever.</p>
              <div className="mt-3 space-y-1.5">
                {ARTICLE_IDEAS.map(idea => (
                  <button key={idea} type="button"
                    onClick={() => setArticleForm(f => ({ ...f, title: idea }))}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-left text-xs leading-snug text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                    {idea}
                  </button>
                ))}
              </div>
            </aside>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveArticle} disabled={saving || coverUploading}>
              {saving ? 'Salvando...' : editingArticle ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
