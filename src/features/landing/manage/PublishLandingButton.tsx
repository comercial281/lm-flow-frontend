import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Loader2, Rocket } from 'lucide-react';
import {
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
import { landingPageService } from '@/services/landingPages/landingPageService';
import { getTenantSlug } from '@/services/core/tenant';
import { useLandingEditorStore } from '@/features/landing/editor';
import { landingPublicUrl, slugifyLandingName } from './landingUrl';

/**
 * Publicar de dentro do editor.
 *
 * Existe porque a landing montada a partir do card do imóvel nascia rascunho e
 * NÃO tinha como ir ao ar: o "Publicar e gerar link" só existia na lista. Quem
 * montava a página pelo imóvel salvava e nunca publicava.
 */
export default function PublishLandingButton({
  siteId,
  pageId,
  siteSlug,
  initialSlug,
  initialActive,
  onSaveBeforePublish,
}: {
  siteId: string;
  pageId: string;
  siteSlug: string;
  initialSlug: string;
  initialActive: boolean;
  /** Salva o que está na tela. Chamado ANTES de publicar quando há alteração pendente. */
  onSaveBeforePublish: () => Promise<void>;
}) {
  const dirty = useLandingEditorStore((s) => s.dirty);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialSlug);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(initialActive);
  const [slug, setSlug] = useState(initialSlug);

  const tenant = getTenantSlug() ?? siteSlug;
  const url = landingPublicUrl(tenant, slug);
  const previewSlug = slugifyLandingName(name);

  const confirm = async () => {
    if (!previewSlug) return;
    setBusy(true);
    try {
      // Salvar ANTES de publicar não é opcional: o Salvar é outro botão, e
      // publicar com alteração pendente entrega ao cliente um link de anúncio
      // apontando pra versão anterior da página.
      if (dirty) await onSaveBeforePublish();
      await landingPageService.publish(siteId, pageId, previewSlug);
      setSlug(previewSlug);
      setActive(true);
      setOpen(false);
      await navigator.clipboard?.writeText(landingPublicUrl(tenant, previewSlug)).catch(() => {});
      toast.success('Publicada! Link copiado para colar no anúncio.');
    } catch {
      toast.error('Erro ao publicar (o nome pode já estar em uso)');
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    setBusy(true);
    try {
      await landingPageService.unpublish(siteId, pageId);
      setActive(false);
      toast.success('Landing despublicada — o link parou de responder.');
    } catch {
      toast.error('Erro ao despublicar');
    } finally {
      setBusy(false);
    }
  };

  if (active) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
          Publicada
        </span>
        <button
          type="button"
          title="Copiar link do anúncio"
          onClick={() => { navigator.clipboard?.writeText(url); toast.success('Link copiado'); }}
          className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
        >
          <Copy size={16} />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Abrir a página publicada"
          className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
        >
          <ExternalLink size={16} />
        </a>
        <button
          type="button"
          onClick={unpublish}
          disabled={busy}
          className="rounded-lg px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-800 disabled:opacity-40"
        >
          Despublicar
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setName(initialSlug); setOpen(true); }}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg border border-violet-600 px-4 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-600/10 disabled:opacity-40"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
        Publicar e gerar link
      </button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : setOpen(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar landing</DialogTitle>
            <DialogDescription>
              O nome vira o endereço da página. É esse link que você cola no anúncio.
              {dirty && ' As alterações abertas são salvas antes de publicar.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <UILabel htmlFor="lp-editor-publish-name">Nome da página</UILabel>
            <Input
              id="lp-editor-publish-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lançamento Jardim Europa"
              autoFocus
            />
            <p className="break-all font-mono text-xs text-muted-foreground">
              {previewSlug ? landingPublicUrl(tenant, previewSlug) : 'Digite um nome para ver o endereço'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={confirm} disabled={busy || !previewSlug}>
              {busy ? 'Publicando…' : 'Publicar e copiar link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
