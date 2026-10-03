import { PROPERTY_FEATURES, CONDO_FEATURES } from '@/features/properties/amenities';
import type { PropsDaSecao } from './tipos';

// Características do imóvel + comodidades do condomínio (aparecem na página pública).
export default function SecaoCaracteristicas({ form: f, setF }: PropsDaSecao) {
  // Por atualização funcional (prev), como a janela antiga fazia: cliques
  // seguidos não se atropelam.
  const alternar = (key: 'features' | 'condo_features', slug: string) =>
    setF(prev => {
      const atual = prev[key] ?? [];
      return { [key]: atual.includes(slug) ? atual.filter(s => s !== slug) : [...atual, slug] };
    });
  const grupo = (titulo: string, key: 'features' | 'condo_features', opcoes: typeof PROPERTY_FEATURES) => (
    <div>
      <p className="mb-2 block text-sm font-medium">{titulo}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(a => {
          const on = (f[key] ?? []).includes(a.slug);
          return (
            <button
              key={a.slug}
              type="button"
              onClick={() => alternar(key, a.slug)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="mt-4 space-y-4">
      {grupo('Características do imóvel', 'features', PROPERTY_FEATURES)}
      {grupo('Comodidades do condomínio', 'condo_features', CONDO_FEATURES)}
    </div>
  );
}
