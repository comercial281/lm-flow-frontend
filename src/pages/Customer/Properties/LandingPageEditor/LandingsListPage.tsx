import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, Copy, ExternalLink, GitBranch, LayoutTemplate, Loader2, Megaphone, Plus, Rocket, Sparkles, Trash2 } from 'lucide-react';
import {
  landingPageService,
  type LandingPageDTO,
} from '@/services/landingPages/landingPageService';
import { landingTemplatesService } from '@/services/landingPages/landingTemplatesService';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';
import { getTenantSlug } from '@/services/core/tenant';
import LeadRoutingModal from './LeadRoutingModal';
import CreateLandingWizard from '@/features/landing/wizard/CreateLandingWizard';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Manage ad landing pages: create blank, edit, and publish (choose a name →
 *  get a hosted public link ready for Ads, no client domain needed). */
export default function LandingsListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteSlug, setSiteSlug] = useState('');
  const [landings, setLandings] = useState<LandingPageDTO[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [routingPage, setRoutingPage] = useState<LandingPageDTO | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const reload = async (sid: string) => setLandings(await landingPageService.listLandings(sid));

  const publicUrl = (slug: string) =>
    `${window.location.origin}/lp/${getTenantSlug() ?? siteSlug}/${slug}`;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sites = await siteBuilderService.listSites();
        if (!active) return;
        if (!sites.length) {
          toast.error('Nenhum site configurado para este cliente.');
          setLoading(false);
          return;
        }
        setSiteId(sites[0].id);
        setSiteSlug(sites[0].slug);
        await reload(sites[0].id);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async () => {
    if (!siteId || !newName.trim()) return;
    setCreating(true);
    try {
      const lp = await landingPageService.createBlank(siteId, newName.trim());
      navigate(`/landings/${lp.dto.id}`);
    } catch {
      toast.error('Erro ao criar a landing page');
      setCreating(false);
    }
  };

  const handlePublish = async (l: LandingPageDTO) => {
    if (!siteId) return;
    const name = window.prompt('Nome da página (vira o link do anúncio):', l.slug)?.trim();
    if (!name) return;
    const slug = slugify(name);
    if (!slug) return toast.error('Nome inválido');
    setBusyId(l.id);
    try {
      await landingPageService.publish(siteId, l.id, slug);
      await navigator.clipboard?.writeText(publicUrl(slug)).catch(() => {});
      toast.success('Publicada! Link copiado para colar no anúncio.');
      await reload(siteId);
    } catch {
      toast.error('Erro ao publicar (nome pode já estar em uso)');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnpublish = async (l: LandingPageDTO) => {
    if (!siteId) return;
    setBusyId(l.id);
    try {
      await landingPageService.unpublish(siteId, l.id);
      await reload(siteId);
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveAsTemplate = async (l: LandingPageDTO) => {
    const name = window.prompt('Nome do template:', `${l.title} (template)`)?.trim();
    if (!name) return;
    // Na raiz (super-admin, sem tenant) dá pra marcar como GLOBAL (todos os clientes).
    const isRoot = getTenantSlug() == null;
    const scope: 'tenant' | 'global' =
      isRoot && window.confirm('Disponibilizar para TODOS os clientes?\n\nOK = todos os clientes (global)\nCancelar = só esta conta')
        ? 'global'
        : 'tenant';
    try {
      await landingTemplatesService.createFromPage(l.id, name, scope);
      toast.success(scope === 'global' ? 'Template GLOBAL salvo (todos os clientes)' : 'Template salvo — já aparece no assistente');
    } catch {
      toast.error('Erro ao salvar o template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!siteId) return;
    try {
      await siteBuilderService.deletePage(siteId, id);
      setLandings((prev) => prev.filter((l) => l.id !== id));
      toast.success('Landing excluída');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Landing Pages de anúncio</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Crie do zero ou a partir de um imóvel. Ao publicar, você escolhe o nome e recebe um link
        hospedado pronto para colar no anúncio — sem depender de domínio.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Nome da nova landing (ex: Campanha Lançamento Setembro)"
          className="min-w-[260px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary disabled:opacity-40"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nova landing do zero
        </button>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          disabled={!siteId}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          Criar com assistente
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : landings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma landing ainda. Crie a primeira acima.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {landings.map((l) => {
            const published = l.active;
            const url = publicUrl(l.slug);
            return (
              <div key={l.id} className="group flex flex-col rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {l.property_id ? <><Building2 className="h-3 w-3" /> Do imóvel</> : <><Megaphone className="h-3 w-3" /> Avulsa</>}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${published ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>
                      {published ? 'Publicada' : 'Rascunho'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleSaveAsTemplate(l)} title="Salvar como template"
                      className="text-muted-foreground hover:text-primary">
                      <LayoutTemplate className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setRoutingPage(l)} title="Roteamento do lead (pipeline/coluna/tag)"
                      className="text-muted-foreground hover:text-primary">
                      <GitBranch className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(l.id)} title="Excluir"
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <button type="button" onClick={() => navigate(`/landings/${l.id}`)} className="flex-1 text-left">
                  <h3 className="line-clamp-2 text-sm font-medium">{l.title}</h3>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">/{l.slug}</p>
                </button>

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
                    <button type="button" onClick={() => handlePublish(l)} disabled={busyId === l.id}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                      {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                      Publicar e gerar link
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {routingPage && siteId && (
        <LeadRoutingModal
          siteId={siteId}
          page={routingPage}
          onClose={() => setRoutingPage(null)}
          onSaved={() => {
            setRoutingPage(null);
            reload(siteId);
          }}
        />
      )}

      {showWizard && siteId && (
        <CreateLandingWizard siteId={siteId} onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
}
