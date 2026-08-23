import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui/ds';
import { Star, Search } from 'lucide-react';
import {
  propertiesService,
  Property,
  TRANSACTION_TYPE_LABELS,
} from '@/services/properties/propertiesService';
import { portalsService } from '@/services/portals/portalsService';

interface Props {
  portalKey: string;
  supportsHighlight: boolean;
  initialSelected: string[];
  initialFeatured: string[];
  onSaved?: () => void;
}

// Seleção de quais imóveis vão pro portal e quais entram como destaque.
// O destaque é POR portal (limite de destaques varia por plano do portal).
export default function PortalPropertiesSelector({
  portalKey,
  supportsHighlight,
  initialSelected,
  initialFeatured,
  onSaved,
}: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [featured, setFeatured] = useState<Set<string>>(new Set(initialFeatured));
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await propertiesService.list({ status: 'active', per_page: 500 });
      setProperties(res.data ?? []);
    } catch {
      toast.error('Erro ao carregar imóveis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(new Set(initialSelected)); }, [initialSelected]);
  useEffect(() => { setFeatured(new Set(initialFeatured)); }, [initialFeatured]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.address_neighborhood ?? '').toLowerCase().includes(q) ||
      (p.address_city ?? '').toLowerCase().includes(q));
  }, [properties, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setFeatured(f => { const nf = new Set(f); nf.delete(id); return nf; });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFeatured = (id: string) => {
    if (!selected.has(id)) return;
    setFeatured(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(properties.map(p => p.id)));

  const save = async () => {
    setSaving(true);
    try {
      await portalsService.updatePublications(portalKey, [...selected], [...featured]);
      toast.success('Publicações atualizadas');
      onSaved?.();
    } catch {
      toast.error('Erro ao salvar publicações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-sm">Imóveis publicados neste portal</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selected.size} selecionado(s){supportsHighlight ? ` · ${featured.size} em destaque` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="text-xs" onClick={selectAll}>Selecionar todos</Button>
          <Button variant="outline" className="text-xs" onClick={() => { setSelected(new Set()); setFeatured(new Set()); }}>
            Limpar
          </Button>
          <Button className="text-xs" onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar publicações'}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por código, título, bairro ou cidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Carregando imóveis...</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nenhum imóvel ativo encontrado. Cadastre imóveis com status Ativo para publicá-los.
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto divide-y rounded-lg border">
          {filtered.map(p => {
            const isSelected = selected.has(p.id);
            const isFeatured = featured.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4 accent-primary shrink-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggle(p.id)}>
                  <p className="text-sm font-medium truncate">
                    <span className="text-muted-foreground font-mono text-xs mr-2">{p.code}</span>
                    {p.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {TRANSACTION_TYPE_LABELS[p.transaction_type] ?? p.transaction_type}
                    {p.display_price ? ` · ${p.display_price}` : ''}
                    {p.address_neighborhood ? ` · ${p.address_neighborhood}` : ''}
                    {p.address_city ? `, ${p.address_city}` : ''}
                  </p>
                </div>
                {supportsHighlight && (
                  <button
                    type="button"
                    title={isFeatured ? 'Remover destaque' : 'Destacar neste portal'}
                    onClick={() => toggleFeatured(p.id)}
                    disabled={!isSelected}
                    className={`shrink-0 p-1.5 rounded-md transition-colors ${
                      isFeatured
                        ? 'text-amber-500'
                        : isSelected
                          ? 'text-muted-foreground hover:text-amber-500'
                          : 'text-muted-foreground/30 cursor-not-allowed'
                    }`}
                  >
                    <Star className="h-4 w-4" fill={isFeatured ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
