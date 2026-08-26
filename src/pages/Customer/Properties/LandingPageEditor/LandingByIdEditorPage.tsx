import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LandingEditor, useLandingEditorStore } from '@/features/landing/editor';
import {
  toLandingProperty,
  type BlockInstance,
  type BrandMode,
  type LandingProperty,
  type LandingTheme,
} from '@/features/landing/blocks';
import { landingPageService } from '@/services/landingPages/landingPageService';
import { toLandingPhotos } from '@/services/landingPages/landingDataAdapters';
import { propertiesService } from '@/services/properties/propertiesService';
import { propertyPhotosService } from '@/services/propertyPhotos/propertyPhotosService';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';
import PublishLandingButton from '@/features/landing/manage/PublishLandingButton';

// Endereço da aba de landings dentro do Site Builder — a casa da funcionalidade.
const LANDINGS_TAB = '/settings/site-builder?tab=landings';

/** Editor for a landing page by its id — standalone (no property) or linked. */
export default function LandingByIdEditorPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteSlug, setSiteSlug] = useState('');
  // Endereço e estado de publicação vivem aqui porque o botão de publicar na
  // barra do editor precisa dos dois.
  const [pageSlug, setPageSlug] = useState('');
  const [pageActive, setPageActive] = useState(false);
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [property, setProperty] = useState<LandingProperty | null>(null);
  const [theme, setThemeState] = useState<Partial<LandingTheme>>({});
  const [brandMode, setBrandModeState] = useState<BrandMode>('client');
  const [title, setTitle] = useState('Landing Page');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!pageId) return;
      try {
        const sites = await siteBuilderService.listSites();
        if (!active) return;
        if (!sites.length) {
          setError('Nenhum site configurado para este cliente. Crie o site em Configurações → Site Builder, aba Configurações.');
          setLoading(false);
          return;
        }
        const site = sites[0];
        const lp = await landingPageService.get(site.id, pageId);
        if (!active) return;
        let prop: LandingProperty | null = null;
        if (lp.dto.property_id) {
          const [p, photos] = await Promise.all([
            propertiesService.get(lp.dto.property_id),
            propertyPhotosService.list(lp.dto.property_id),
          ]);
          if (!active) return;
          prop = toLandingProperty(p, toLandingPhotos(photos));
        }
        setSiteId(site.id);
        setSiteSlug(site.slug);
        setPageSlug(lp.dto.slug);
        setPageActive(lp.dto.active);
        setBlocks(lp.blocks);
        setProperty(prop);
        setThemeState(lp.theme);
        setBrandModeState((lp.dto.brand_mode as BrandMode) ?? 'client');
        setTitle(lp.dto.title || 'Landing Page');
        setLoading(false);
      } catch {
        if (!active) return;
        setError('Não foi possível carregar a landing page.');
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [pageId]);

  const handleSave = async (next: BlockInstance[]) => {
    if (!siteId || !pageId) return;
    setSaving(true);
    try {
      const { theme: t, brandMode: bm } = useLandingEditorStore.getState();
      await landingPageService.saveBlocks(siteId, pageId, next, t, bm);
      toast.success('Landing page salva');
    } catch {
      toast.error('Erro ao salvar a landing page');
    } finally {
      setSaving(false);
    }
  };

  // Publicar salva o que está na tela primeiro; sem isto o link do anúncio
  // apontaria para a versão anterior da página.
  const saveCurrent = async () => {
    const { blocks: current, markSaved } = useLandingEditorStore.getState();
    await handleSave(current);
    markSaved();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        Carregando editor…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-neutral-300">
        <p className="max-w-md">{error}</p>
        <button
          type="button"
          onClick={() => navigate(LANDINGS_TAB)}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <LandingEditor
        title={`Landing: ${title}`}
        initialBlocks={blocks}
        property={property}
        initialTheme={theme}
        initialBrandMode={brandMode}
        saving={saving}
        onSave={handleSave}
        onBack={() => navigate(LANDINGS_TAB)}
        headerActions={
          siteId && pageId ? (
            <PublishLandingButton
              siteId={siteId}
              pageId={pageId}
              siteSlug={siteSlug}
              initialSlug={pageSlug}
              initialActive={pageActive}
              onSaveBeforePublish={saveCurrent}
            />
          ) : null
        }
      />
    </div>
  );
}
