import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Badge, Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Label as UILabel,
} from '@/components/ui/ds';
import { Edit, FileText, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, Upload, Users } from 'lucide-react';
import { formatDateBR } from '@/utils/dateUtils';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import {
  ACOES_DA_PAGINA, RichTextEditor, htmlComoOEditorDevolve, paginaDoSiteSchema, type RichTextEditorRef,
} from '@/components/chat/rich-text-editor';
import '@/components/chat/rich-text-editor/RichTextEditor.css';
import {
  siteBuilderService, type ModeloDePagina, type PageFormData, type Site, type SitePage,
} from '@/services/siteBuilder/siteBuilderService';
import { CampoTexto } from '@/components/base/Campo';

/** O que a tela Páginas avisa ao pai: o menu da tela Menus acompanha as páginas. */
export type MudancaDePagina =
  | { tipo: 'salva'; pagina: SitePage; slugAntigo?: string }
  | { tipo: 'excluida'; slug: string };

interface Props {
  site: Site;
  /** Muda quando o Salvar do menu regravou o "Exibir no menu" das páginas: a lista relê. */
  versaoDasPaginas?: number;
  aoMudarPagina?: (m: MudancaDePagina) => void;
}

type FormDaPagina = Omit<PageFormData, 'content_html'>;

const FORM_VAZIO: FormDaPagina = { title: '', slug: '', active: true, in_menu: true, menu_position: 0 };

/** 409: duas criações ao mesmo tempo bateram no mesmo endereço. */
const FRASE_DO_CONFLITO = 'Outra página acabou de ser criada com o mesmo endereço. Tente de novo em instantes.';

interface ErroDaApi {
  response?: { status?: number; data?: { error?: { message?: string; details?: { field?: string } } } };
}
const statusDo = (e: unknown) => (e as ErroDaApi)?.response?.status;
const campoDoErro = (e: unknown) => (e as ErroDaApi)?.response?.data?.error?.details?.field;

/** 422 do conteúdo (passou de 200 KB ou estrutura que não dá pra salvar): vira aviso dentro da janela. */
const ehErroDoConteudo = (e: unknown, msg: string) => statusDo(e) === 422 && /200 KB|estrutura/i.test(msg);

const ehHttp = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

export default function TelaPaginas({ site, versaoDasPaginas = 0, aoMudarPagina }: Props) {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  // Janela "Nova página": em branco ou a partir de um modelo.
  const [escolhaAberta, setEscolhaAberta] = useState(false);
  const [pedindoDocumento, setPedindoDocumento] = useState(false);
  const [documento, setDocumento] = useState('');
  const [erroDocumento, setErroDocumento] = useState<string | null>(null);
  const [avisoDoModelo, setAvisoDoModelo] = useState<string | null>(null);
  const [criandoModelo, setCriandoModelo] = useState<ModeloDePagina | null>(null);

  // Janela da página (criar em branco ou editar).
  const [pageModal, setPageModal] = useState(false);
  const [editingPage, setEditingPage] = useState<SitePage | null>(null);
  const [pageForm, setPageForm] = useState<FormDaPagina>(FORM_VAZIO);
  const [saving, setSaving] = useState(false);
  const [avisoDoConteudo, setAvisoDoConteudo] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorRef>(null);
  // Semente do editor: o HTML com que ele monta a cada abertura (a `key` muda).
  const [semente, setSemente] = useState({ html: '', nonce: 0 });
  // O conteúdo como o editor o devolve ao abrir. Salvar sem mexer não manda o
  // conteúdo: o servidor não regrava (nem relimpa) o que ninguém tocou.
  const conteudoAoAbrir = useRef('');

  // Imagem no conteúdo: endereço colado ou arquivo enviado.
  const [imagemAberta, setImagemAberta] = useState(false);
  const [imagemUrl, setImagemUrl] = useState('');
  const [imagemAlt, setImagemAlt] = useState('');
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const arquivoDaImagem = useRef<HTMLInputElement>(null);

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

  useEffect(() => { loadPages(); }, [loadPages, versaoDasPaginas]);

  const abrirJanela = (pagina: SitePage | null) => {
    setEditingPage(pagina);
    setPageForm(pagina
      ? { title: pagina.title, slug: pagina.slug, active: pagina.active, in_menu: pagina.in_menu, menu_position: pagina.menu_position ?? 0 }
      : { ...FORM_VAZIO, menu_position: pages.reduce((m, p) => Math.max(m, p.menu_position ?? 0), 0) + 1 });
    const html = pagina?.content_html ?? '';
    setSemente(s => ({ html, nonce: s.nonce + 1 }));
    conteudoAoAbrir.current = htmlComoOEditorDevolve(html, paginaDoSiteSchema);
    setAvisoDoConteudo(null);
    setImagemAberta(false);
    setPageModal(true);
  };

  const abrirEscolha = () => {
    setPedindoDocumento(false);
    setDocumento('');
    setErroDocumento(null);
    setAvisoDoModelo(null);
    setEscolhaAberta(true);
  };

  const emBranco = () => {
    setEscolhaAberta(false);
    abrirJanela(null);
  };

  const criarDoModelo = async (modelo: ModeloDePagina) => {
    if (modelo === 'privacy' && !documento.trim()) { setErroDocumento('Informe o CPF ou o CNPJ.'); return; }
    setErroDocumento(null);
    setAvisoDoModelo(null);
    setCriandoModelo(modelo);
    try {
      const criada = await siteBuilderService.createPageFromTemplate(
        site.id, modelo, modelo === 'privacy' ? documento.trim() : undefined,
      );
      setPages(prev => [...prev, criada]);
      aoMudarPagina?.({ tipo: 'salva', pagina: criada });
      setEscolhaAberta(false);
      toast.success('Página criada desativada e fora do menu. Revise o texto e ative quando estiver pronta.');
      abrirJanela(criada);
    } catch (e) {
      const msg = apiErrorMessage(e, 'Não deu pra criar a página. Tente de novo.');
      const campo = campoDoErro(e);
      if (statusDo(e) === 422 && (campo === 'document' || campo === 'cnpj')) setErroDocumento(msg);
      else if (statusDo(e) === 409) setAvisoDoModelo(FRASE_DO_CONFLITO);
      else setAvisoDoModelo(msg);
    } finally {
      setCriandoModelo(null);
    }
  };

  const handleSavePage = async () => {
    if (!site || !pageForm.title.trim()) { toast.error('Título é obrigatório'); return; }
    const editor = editorRef.current;
    const html = editor ? editor.getContent() : null;
    const payload: PageFormData = { ...pageForm };
    if (!editingPage) payload.content_html = html ?? '';
    else if (html !== null && html !== conteudoAoAbrir.current) payload.content_html = html;
    setSaving(true);
    setAvisoDoConteudo(null);
    try {
      if (editingPage) {
        const updated = await siteBuilderService.updatePage(site.id, editingPage.id, payload);
        setPages(prev => prev.map(p => p.id === updated.id ? updated : p));
        aoMudarPagina?.({ tipo: 'salva', pagina: updated, slugAntigo: editingPage.slug });
        toast.success('Página atualizada');
      } else {
        const created = await siteBuilderService.createPage(site.id, payload);
        setPages(prev => [...prev, created]);
        aoMudarPagina?.({ tipo: 'salva', pagina: created });
        toast.success('Página criada');
      }
      setPageModal(false);
    } catch (e) {
      const msg = apiErrorMessage(e, 'Erro ao salvar página');
      if (ehErroDoConteudo(e, msg)) setAvisoDoConteudo(msg);
      else if (statusDo(e) === 409) toast.error(FRASE_DO_CONFLITO);
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (page: SitePage) => {
    if (!site) return;
    const ok = await confirmar({
      titulo: 'Excluir página',
      descricao: `A página "${page.title}" sai do site e do menu. Não dá pra desfazer.`,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await siteBuilderService.deletePage(site.id, page.id);
      setPages(prev => prev.filter(p => p.id !== page.id));
      aoMudarPagina?.({ tipo: 'excluida', slug: page.slug });
      toast.success('Página removida');
    } catch {
      toast.error('Erro ao remover página');
    }
  };

  const inserirImagem = (url: string, alt: string) => {
    editorRef.current?.insertImage(url.trim(), alt.trim());
    setImagemUrl('');
    setImagemAlt('');
    setImagemAberta(false);
  };

  const enviarImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Envie um arquivo de imagem (JPG, PNG ou WEBP).'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Imagem muito grande (máx 8MB). Comprima antes de enviar.'); return; }
    setEnviandoImagem(true);
    try {
      const { url } = await siteBuilderService.uploadAsset(file);
      inserirImagem(url, imagemAlt);
    } catch {
      toast.error('Falha no envio da imagem.');
    } finally {
      setEnviandoImagem(false);
    }
  };

  const avisoDaImagem = imagemUrl.trim() && !ehHttp(imagemUrl)
    ? 'Use um endereço que comece com http:// ou https://. Imagem com outro endereço não é salva.'
    : undefined;

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{pages.length} página{pages.length !== 1 ? 's' : ''}</p>
          <Button size="sm" onClick={abrirEscolha}>
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
            <Button size="sm" className="mt-3" onClick={abrirEscolha}>
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
                  <Button variant="ghost" size="icon" onClick={() => abrirJanela(page)} aria-label="Editar página" title="Editar página">
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

      {/* Nova página: em branco ou a partir de um modelo pronto */}
      <Dialog open={escolhaAberta} onOpenChange={setEscolhaAberta}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova página</DialogTitle>
            <DialogDescription>
              Comece do zero ou de um modelo. Os modelos já vêm com o nome e o contato do site e são criados desativados e fora do menu, pra você revisar antes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <OpcaoDeModelo icone={<FileText className="h-5 w-5" aria-hidden />} titulo="Em branco"
              frase="Uma página vazia pra escrever do zero." onClick={emBranco} disabled={!!criandoModelo} />
            <OpcaoDeModelo icone={<Users className="h-5 w-5" aria-hidden />} titulo="Sobre nós"
              frase="Um texto-base com o nome, a cidade e o contato do site, pra você ajustar."
              onClick={() => criarDoModelo('about')} disabled={!!criandoModelo} carregando={criandoModelo === 'about'} />
            <OpcaoDeModelo icone={<ShieldCheck className="h-5 w-5" aria-hidden />} titulo="Política de privacidade"
              frase="O texto da LGPD com o nome, o CPF ou CNPJ e o contato do site."
              onClick={() => setPedindoDocumento(true)} disabled={!!criandoModelo} aberta={pedindoDocumento} />
            {pedindoDocumento && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                <CampoTexto id="pagina-documento" rotulo="CPF ou CNPJ" valor={documento} inputMode="text" autoComplete="off"
                  placeholder="00.000.000/0000-00"
                  ajuda="Aparece no texto da política, junto do nome do site. Corretor autônomo pode usar o CPF."
                  erro={erroDocumento ?? undefined}
                  aoMudar={v => { setDocumento(v); setErroDocumento(null); }} />
                <Button onClick={() => criarDoModelo('privacy')} disabled={!!criandoModelo}>
                  {criandoModelo === 'privacy' ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Criando...</> : 'Criar a política'}
                </Button>
              </div>
            )}
            {avisoDoModelo && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{avisoDoModelo}</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* A página: título, endereço, conteúdo e as caixinhas */}
      <Dialog open={pageModal} onOpenChange={setPageModal}>
        <DialogContent size="wide" className="sm:max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage ? 'Editar página' : 'Nova página'}</DialogTitle>
            <DialogDescription>O texto da página e se ela aparece no site e no menu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <CampoTexto id="pagina-titulo" rotulo="Título *" valor={pageForm.title} placeholder="Ex: Sobre nós"
              ajuda="Aparece no alto da página e é o nome dela no menu (dá pra trocar o nome do menu na tela Menus)."
              aoMudar={title => setPageForm(f => ({ ...f, title }))} />
            <CampoTexto id="pagina-endereco" rotulo="Endereço da página (URL)" valor={pageForm.slug ?? ''} placeholder="sobre-nos"
              classeDoControle="font-mono"
              ajuda={editingPage
                ? 'O final do endereço da página, sem espaço nem acento. Se trocar, a página perde o nome e a posição que você deu a ela na tela Menus.'
                : 'O final do endereço da página, sem espaço nem acento.'}
              aoMudar={slug => setPageForm(f => ({ ...f, slug }))} />

            <div className="space-y-2">
              <p className="text-sm font-medium">Conteúdo</p>
              <RichTextEditor key={semente.nonce} ref={editorRef} conteudoInicial={semente.html}
                showToolbar schema={paginaDoSiteSchema} acoes={ACOES_DA_PAGINA}
                editorMinHeightClass="min-h-[400px]" editorMaxHeightClass="max-h-[65vh]"
                aoPedirImagem={() => setImagemAberta(true)}
                placeholder="Escreva o texto da página. Use a barra para título, listas, link e imagem." />
              {imagemAberta && (
                <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <CampoTexto id="pagina-imagem-endereco" rotulo="Endereço da imagem" valor={imagemUrl} inputMode="url"
                      placeholder="https://..." aviso={avisoDaImagem} aoMudar={setImagemUrl} />
                    <CampoTexto id="pagina-imagem-descricao" rotulo="Descrição da imagem" valor={imagemAlt}
                      placeholder="Ex: Fachada da imobiliária" ajuda="Lida por quem não enxerga a imagem e pelo Google."
                      aoMudar={setImagemAlt} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => inserirImagem(imagemUrl, imagemAlt)}
                      disabled={!ehHttp(imagemUrl) || enviandoImagem}>
                      Pôr a imagem
                    </Button>
                    <input ref={arquivoDaImagem} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      aria-label="Escolher arquivo: imagem da página" onChange={enviarImagem} />
                    <Button type="button" variant="outline" disabled={enviandoImagem} onClick={() => arquivoDaImagem.current?.click()}>
                      {enviandoImagem
                        ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Enviando...</>
                        : <><Upload className="mr-1.5 h-4 w-4" aria-hidden /> Enviar do computador</>}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setImagemAberta(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Texto colado do Word, do Google Docs ou de outro site é arrumado ao salvar: fica o título, o subtítulo, as listas, a citação, os links e as imagens.
              </p>
              {avisoDoConteudo && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{avisoDoConteudo}</p>}
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="page_active" checked={pageForm.active ?? true}
                  onCheckedChange={c => setPageForm(f => ({ ...f, active: c === true }))} />
                <UILabel htmlFor="page_active" className="cursor-pointer text-base font-normal">Ativa</UILabel>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="page_menu" checked={pageForm.in_menu ?? true}
                  onCheckedChange={c => setPageForm(f => ({ ...f, in_menu: c === true }))} />
                <UILabel htmlFor="page_menu" className="cursor-pointer text-base font-normal">Exibir no menu</UILabel>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Desmarcada, a página sai do ar. Com Exibir no menu, o link dela aparece no menu do site; é a mesma caixinha Mostrar da tela Menus.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageModal(false)}>Cancelar</Button>
            <Button onClick={handleSavePage} disabled={saving || enviandoImagem}>
              {saving ? 'Salvando...' : editingPage ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialogoDeConfirmacao}
    </>
  );
}

function OpcaoDeModelo({ icone, titulo, frase, onClick, disabled, carregando, aberta }: {
  icone: React.ReactNode; titulo: string; frase: string; onClick: () => void;
  disabled?: boolean; carregando?: boolean; aberta?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-expanded={aberta}
      className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="mt-0.5 text-muted-foreground">{carregando ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : icone}</span>
      <span className="min-w-0">
        <span className="block text-base font-medium">{titulo}</span>
        <span className="block text-sm text-muted-foreground">{frase}</span>
      </span>
    </button>
  );
}
