import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LandingEditor } from '@/features/landing/editor';
import {
  defaultPropertyBlocks,
  toLandingProperty,
  type BlockInstance,
  type LandingProperty,
} from '@/features/landing/blocks';
import { toLandingPhotos } from '@/services/landingPages/landingDataAdapters';
import { propertiesService } from '@/services/properties/propertiesService';
import { propertyPhotosService } from '@/services/propertyPhotos/propertyPhotosService';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';

/** Editor do template ÚNICO da página de imóvel do portal (Produto A).
 *  O cliente monta o layout uma vez; todo imóvel publicado renderiza dele +
 *  os próprios dados. Preview usa um imóvel real de amostra. */
export default function PropertyTemplateEditorPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [property, setProperty] = useState<LandingProperty | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sites = await siteBuilderService.listSites();
        if (!active) return;
        if (!sites.length) {
          setError('Nenhum site configurado para este cliente.');
          setLoading(false);
          return;
        }
        const site = sites[0];
        const [tpl, list] = await Promise.all([
          siteBuilderService.getPropertyTemplate(site.id),
          propertiesService.list({ per_page: 1 }),
        ]);
        if (!active) return;

        let prop: LandingProperty | null = null;
        const sample = list.data[0];
        if (sample) {
          const photos = await propertyPhotosService.list(sample.id);
          if (!active) return;
          prop = toLandingProperty(sample, toLandingPhotos(photos));
        }

        setSiteId(site.id);
        // Template vazio -> começa do template padrão (não tela em branco).
        setBlocks(tpl.length ? tpl : defaultPropertyBlocks());
        setProperty(prop);
        setLoading(false);
      } catch {
        if (!active) return;
        setError('Não foi possível carregar o editor do portal.');
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (next: BlockInstance[]) => {
    if (!siteId) return;
    setSaving(true);
    try {
      await siteBuilderService.savePropertyTemplate(siteId, next);
      toast.success('Template do imóvel salvo. Vale para todos os imóveis.');
    } catch {
      toast.error('Erro ao salvar o template');
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
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <LandingEditor
        title="Template da página de imóvel (portal)"
        initialBlocks={blocks}
        property={property}
        saving={saving}
        onSave={handleSave}
        onBack={() => navigate('/properties')}
      />
    </div>
  );
}
