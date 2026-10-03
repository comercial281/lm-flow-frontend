import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Input, Label as UILabel, Textarea,
} from '@/components/ui/ds';
import { Edit, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { formatDateBR } from '@/utils/dateUtils';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  siteBuilderService, type PageFormData, type Site, type SitePage,
} from '@/services/siteBuilder/siteBuilderService';

const EMPTY_PAGE_FORM: PageFormData = {
  title: '',
  slug: '',
  content_html: '',
  active: true,
  in_menu: true,
  menu_position: 0,
};

export default function TelaPaginas({ site }: { site: Site }) {
  // Pages
  const [pages, setPages] = useState<SitePage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pageModal, setPageModal] = useState(false);
  const [editingPage, setEditingPage] = useState<SitePage | null>(null);
  const [pageForm, setPageForm] = useState<PageFormData>(EMPTY_PAGE_FORM);
  const [saving, setSaving] = useState(false);

  const loadPages = useCallback(async () => {
    if (!site) return;
    setPagesLoading(true);
    try {
      // Só as páginas do PORTAL. A landing de anúncio é feita de blocos e tem
      // aba própria — listada aqui, o botão Editar abria o editor simples de
      // título/HTML e salvava por cima do que o construtor montou.
      const all = await siteBuilderService.listPages(site.id);
      setPages(all.filter(p => p.page_kind !== 'ad_landing'));
    } catch {
      toast.error('Erro ao carregar páginas');
    } finally {
      setPagesLoading(false);
    }
  }, [site]);

  useEffect(() => { loadPages(); }, [loadPages]);

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
      content_html: page.content_html ?? '',
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

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{pages.length} página{pages.length !== 1 ? 's' : ''}</p>
          <Button size="sm" onClick={openCreatePage}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nova página
          </Button>
        </div>

        {pagesLoading ? (
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
                  <p className="text-xs text-muted-foreground mt-0.5">/{page.slug} · Criada {formatDateBR(page.created_at)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditPage(page)} aria-label="Editar página" title="Editar página">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeletePage(page)}
                    aria-label="Excluir página"
                    title="Excluir página">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
              <UILabel>Endereço da página (URL)</UILabel>
              <Input value={pageForm.slug ?? ''}
                onChange={e => setPageForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="sobre-nos" className="mt-1 font-mono" />
            </div>
            <div>
              <UILabel>Conteúdo (HTML)</UILabel>
              <Textarea value={pageForm.content_html ?? ''}
                onChange={e => setPageForm(f => ({ ...f, content_html: e.target.value }))}
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
    </>
  );
}
