import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { LandingEditor, useLandingEditorStore } from '@/features/landing/editor';
import {
  createBlock,
  toLandingProperty,
  type BlockInstance,
  type BlockType,
  type BrandMode,
  type LandingPhoto,
  type LandingProperty,
  type LandingTheme,
} from '@/features/landing/blocks';
import { landingPageService } from '@/services/landingPages/landingPageService';
import { propertiesService } from '@/services/properties/propertiesService';
import {
  propertyPhotosService,
  type PropertyPhoto,
} from '@/services/propertyPhotos/propertyPhotosService';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';

// Landing de imóvel nova nasce com um esqueleto pronto (não em branco): as seções
// já renderizam com os dados reais do imóvel (preço, ficha, fotos, mapa). O corretor
// só ajusta e salva, em vez de montar do zero.
const DEFAULT_LANDING_SECTIONS: BlockType[] = [
  'hero',
  'price_band',
  'gallery',
  'tech_sheet',
  'description',
  'amenities',
  'map',
  'finance_simulator',
  'lead_form',
  'sticky_cta',
];

function seedDefaultBlocks(): BlockInstance[] {
  return DEFAULT_LANDING_SECTIONS.map((t) => createBlock(t));
}

function toLandingPhotos(photos: PropertyPhoto[]): LandingPhoto[] {
  return photos
    .filter((p) => p.published)
    .map((p) => ({
      url: p.file_url,
      thumbnailUrl: p.thumbnail_url ?? undefined,
      caption: p.caption ?? undefined,
      alt: p.alt_text ?? undefined,
      isCover: p.is_cover,
    }));
}

/** Full-screen visual editor for a property's ad landing page (Trilha B). */
export default function LandingPageEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [property, setProperty] = useState<LandingProperty | null>(null);
  const [theme, setThemeState] = useState<Partial<LandingTheme>>({});
  const [brandMode, setBrandModeState] = useState<BrandMode>('development');
  const [title, setTitle] = useState('Landing Page');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      try {
        const [prop, photos, sites] = await Promise.all([
          propertiesService.get(id),
          propertyPhotosService.list(id),
          siteBuilderService.listSites(),
        ]);
        if (!active) return;
        if (!sites.length) {
          setError('Nenhum site configurado para este cliente. Crie o site em Configurações → Site primeiro.');
          setLoading(false);
          return;
        }
        const site = sites[0];
        const lp = await landingPageService.getOrCreateForProperty(site.id, {
          propertyId: prop.id,
          title: prop.title,
          slug: `lp-${prop.code.toLowerCase()}`,
        });
        if (!active) return;
        setSiteId(site.id);
        setPageId(lp.dto.id);
        // Landing vazia (recém-criada) → abre já com o esqueleto padrão preenchido.
        setBlocks(lp.blocks.length ? lp.blocks : seedDefaultBlocks());
        setProperty(toLandingProperty(prop, toLandingPhotos(photos)));
        setThemeState(lp.theme);
        setBrandModeState((lp.dto.brand_mode as BrandMode) ?? 'development');
        setTitle(`Landing: ${prop.title}`);
        setLoading(false);
      } catch {
        if (!active) return;
        setError('Não foi possível carregar o editor da landing page.');
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

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
          onClick={() => navigate('/properties')}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Voltar para Imóveis
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <LandingEditor
        title={title}
        initialBlocks={blocks}
        property={property}
        initialTheme={theme}
        initialBrandMode={brandMode}
        saving={saving}
        onSave={handleSave}
        onBack={() => navigate('/properties')}
      />
    </div>
  );
}
