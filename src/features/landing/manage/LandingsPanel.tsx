import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label as UILabel,
} from '@/components/ui/ds';
import { Building2, Copy, ExternalLink, GitBranch, LayoutTemplate, Loader2, Megaphone, Plus, Rocket, Sparkles, Trash2 } from 'lucide-react';
import {
  landingPageService,
  type LandingPageDTO,
} from '@/services/landingPages/landingPageService';
import { landingTemplatesService } from '@/services/landingPages/landingTemplatesService';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';
import { getTenantSlug } from '@/services/core/tenant';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import LeadRoutingModal from './LeadRoutingModal';
import CreateLandingWizard from '@/features/landing/wizard/CreateLandingWizard';
import { landingPublicUrl, slugifyLandingName } from './landingUrl';

/**
 * Painel das landings de anúncio — vive como aba dentro do Site Builder.
 *
 * Não descobre o site sozinho: quem sabe qual é o site é a tela-mãe, que já o
 * carregou. Antes este painel chamava listSites() e, sem site, morria num aviso
 * vermelho sem saída; hoje o Site Builder mostra o mesmo estado vazio das outras
 * abas, com botão pra aba Configurações — onde o site nasce.
 */
export default function LandingsPanel({ siteId, siteSlug }: { siteId: string; siteSlug: string }) {
  const navigate = useNavigate();
  const isSuper = useIsSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [landings, setLandings] = useState<LandingPageDTO[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [routingPage, setRoutingPage] = useState<LandingPageDTO | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Publicar: nome vira o endereço do anúncio, mostrado ao vivo enquanto digita.
  const [publishing, setPublishing] = useState<LandingPageDTO | null>(null);
  const [publishName, setPublishName] = useState('');

  // Excluir: landing publicada mata o link que já está no anúncio — confirma.
  const [deleting, setDeleting] = useState<LandingPageDTO | null>(null);

  // Salvar como template (só a Leal Mídia: template global é decisão da casa).
  const [templating, setTemplating] = useState<LandingPageDTO | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateScope, setTemplateScope] = useState<'tenant' | 'global'>('tenant');

  const reload = useCallback(async () => {
    setLandings(await landingPageService.listLandings(siteId));
  }, [siteId]);

  const publicUrl = (slug: string) => landingPublicUrl(getTenantSlug() ?? siteSlug, slug);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await landingPageService.listLandings(siteId);
        if (active) setLandings(list);
      } catch {
        if (active) toast.error('Erro ao carregar as landings');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [siteId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const lp = await landingPageService.createBlank(siteId, newName.trim());
      navigate(`/landings/${lp.dto.id}`);
    } catch {
      toast.error('Erro ao criar a landing page');
      setCreating(false);
    }
  };

  const openPublish = (l: LandingPageDTO) => {
    setPublishName(l.title || l.slug);
    setPublishing(l);
  };

  const confirmPublish = async () => {
    if (!publishing) return;
    const slug = slugifyLandingName(publishName);
    if (!slug) return toast.error('Nome inválido');
    setBusyId(publishing.id);
    const page = publishing;
    setPublishing(null);
    try {
      await landingPageService.publish(siteId, page.id, slug);
      await navigator.clipboard?.writeText(publicUrl(slug)).catch(() => {});
      toast.success('Publicada! Link copiado para colar no anúncio.');
      await reload();
    } catch {
      toast.error('Erro ao publicar (o nome pode já estar em uso)');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnpublish = async (l: LandingPageDTO) => {
    setBusyId(l.id);
    try {
      await landingPageService.unpublish(siteId, l.id);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const openTemplate = (l: LandingPageDTO) => {
    setTemplateName(`${l.title} (template)`);
    setTemplateScope('tenant');
    setTemplating(l);
  };

  const confirmTemplate = async () => {
    if (!templating || !templateName.trim()) return;
    const page = templating;
    const scope = templateScope;
    setTemplating(null);
    try {
      await landingTemplatesService.createFromPage(page.id, templateName.trim(), scope);
      toast.success(
        scope === 'global'
          ? 'Template GLOBAL salvo (todos os clientes)'
          : 'Template salvo — já aparece no assistente',
      );
    } catch {
      toast.error('Erro ao salvar o template');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const page = deleting;
    setDeleting(null);
    try {
      await siteBuilderService.deletePage(siteId, page.id);
      setLandings((prev) => prev.filter((l) => l.id !== page.id));
      toast.success('Landing excluída');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Crie do zero ou a partir de um imóvel. Ao publicar, você escolhe o nome e recebe um link
        hospedado pronto para colar no anúncio — sem depender de domínio.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Nome da nova landing (ex: Campanha Lançamento Setembro)"
          className="min-w-[260px] flex-1"
        />
        <Button variant="outline" onClick={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
          Criar do zero
        </Button>
        <Button onClick={() => setShowWizard(true)}>
          <Sparkles className="h-4 w-4 mr-1.5" />
          Criar com assistente
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : landings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Megaphone className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Nenhuma landing de anúncio ainda</p>
          <Button size="sm" className="mt-3" onClick={() => setShowWizard(true)}>
            <Sparkles className="h-4 w-4 mr-1" />
            Criar a primeira
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {landings.map((l) => {
            const published = l.active;
            const url = publicUrl(l.slug);
            return (
              <div key={l.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {l.property_id ? <><Building2 className="h-3 w-3" /> Do imóvel</> : <><Megaphone className="h-3 w-3" /> Avulsa</>}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${published ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>
                      {published ? 'Publicada' : 'Rascunho'}
                    </span>
                  </div>
                </div>

                <button type="button" onClick={() => navigate(`/landings/${l.id}`)} className="flex-1 text-left">
                  <h3 className="line-clamp-2 text-sm font-medium">{l.title}</h3>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">/{l.slug}</p>
                </button>

                {/* Rótulos visíveis de propósito: ícone sozinho não conta o que
                    "para onde vai o lead" faz, e esta tela é nova pro cliente. */}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3">
                  <button type="button" onClick={() => setRoutingPage(l)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    <GitBranch className="h-3.5 w-3.5" /> Destino do lead
                  </button>
                  {isSuper && (
                    <button type="button" onClick={() => openTemplate(l)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <LayoutTemplate className="h-3.5 w-3.5" /> Salvar como template
                    </button>
                  )}
                  <button type="button" onClick={() => setDeleting(l)}
                    className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  {published ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <input readOnly value={url} className="flex-1 truncate rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground" />
                        <button type="button" title="Copiar link" onClick={() => { navigator.clipboard?.writeText(url); toast.success('Link copiado'); }}
                          className="rounded-md border border-border p-1.5 hover:border-primary">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <a href={url} target="_blank" rel="noreferrer" title="Abrir"
                          className="rounded-md border border-border p-1.5 hover:border-primary">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <button type="button" onClick={() => handleUnpublish(l)} disabled={busyId === l.id}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Despublicar
                      </button>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={() => openPublish(l)} disabled={busyId === l.id}>
                      {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4 mr-1.5" />}
                      Publicar e gerar link
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Publicar — mostra o endereço final enquanto digita, porque o nome é
          convertido (acento, espaço, corte em 60) e o resultado surpreende. */}
      <Dialog open={!!publishing} onOpenChange={(v) => (v ? null : setPublishing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar landing</DialogTitle>
            <DialogDescription>
              O nome vira o endereço da página. É esse link que você cola no anúncio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <UILabel htmlFor="lp-publish-name">Nome da página</UILabel>
            <Input
              id="lp-publish-name"
              value={publishName}
              onChange={(e) => setPublishName(e.target.value)}
              placeholder="Ex: Lançamento Jardim Europa"
              autoFocus
            />
            <p className="break-all font-mono text-xs text-muted-foreground">
              {slugifyLandingName(publishName)
                ? publicUrl(slugifyLandingName(publishName))
                : 'Digite um nome para ver o endereço'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishing(null)}>Cancelar</Button>
            <Button onClick={confirmPublish} disabled={!slugifyLandingName(publishName)}>
              Publicar e copiar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salvar como template */}
      <Dialog open={!!templating} onOpenChange={(v) => (v ? null : setTemplating(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar como template</DialogTitle>
            <DialogDescription>
              O template guarda as seções e as cores desta landing, para começar outras a partir dela.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <UILabel htmlFor="lp-template-name">Nome do template</UILabel>
              <Input
                id="lp-template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <UILabel>Quem pode usar</UILabel>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="lp-template-scope" checked={templateScope === 'tenant'}
                  onChange={() => setTemplateScope('tenant')} />
                Só esta conta
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="lp-template-scope" checked={templateScope === 'global'}
                  onChange={() => setTemplateScope('global')} />
                Todos os clientes
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplating(null)}>Cancelar</Button>
            <Button onClick={confirmTemplate} disabled={!templateName.trim()}>Salvar template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => (v ? null : setDeleting(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.active
                ? 'Esta landing está PUBLICADA. Excluir derruba o link que já está no ar — quem clicar no anúncio cai numa página que não existe mais. Os leads já capturados continuam no CRM.'
                : 'A landing e as seções montadas nela são apagadas. Os leads já capturados continuam no CRM.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {routingPage && (
        <LeadRoutingModal
          siteId={siteId}
          page={routingPage}
          onClose={() => setRoutingPage(null)}
          onSaved={() => {
            setRoutingPage(null);
            reload();
          }}
        />
      )}

      {showWizard && <CreateLandingWizard siteId={siteId} onClose={() => setShowWizard(false)} />}
    </div>
  );
}
