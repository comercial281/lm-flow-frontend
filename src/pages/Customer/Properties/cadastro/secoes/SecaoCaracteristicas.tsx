import { PROPERTY_FEATURES, CONDO_FEATURES } from '@/features/properties/amenities';
import { dicaSe, useCampoTravado } from '@/features/properties/cadastro/travasDoSite';
import type { PropsDaSecao } from './tipos';

// Características do imóvel + comodidades do condomínio (aparecem na página pública).
// Empreendimento mostra só o lazer e o condomínio.
export default function SecaoCaracteristicas({ form: f, setF }: PropsDaSecao) {
  const empreendimento = f.listing_kind === 'development';
  // Imóvel do site: as características que vêm de lá ficam travadas.
  const trava = { features: useCampoTravado('features'), condo_features: useCampoTravado('condo_features') };
  // Por atualização funcional (prev): cliques seguidos não se atropelam. Parte
  // do array salvo, então slug já gravado e que não é mais oferecido (ex.:
  // 'agua') continua lá.
  const alternar = (key: 'features' | 'condo_features', slug: string) =>
    setF(prev => {
      const atual = prev[key] ?? [];
      return { [key]: atual.includes(slug) ? atual.filter(s => s !== slug) : [...atual, slug] };
    });
  const grupo = (titulo: string, key: 'features' | 'condo_features', opcoes: typeof PROPERTY_FEATURES) => (
    <div title={dicaSe(trava[key])}>
      <p className="mb-2 block text-sm font-medium">{titulo}</p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(a => {
          const on = (f[key] ?? []).includes(a.slug);
          return (
            <button
              key={a.slug}
              type="button"
              aria-pressed={on}
              disabled={trava[key]}
              onClick={() => alternar(key, a.slug)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:bg-muted'}`}
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
      {!empreendimento && grupo('Do imóvel', 'features', PROPERTY_FEATURES)}
      {grupo(empreendimento ? 'Lazer e condomínio do empreendimento' : 'Do condomínio', 'condo_features', CONDO_FEATURES)}
    </div>
  );
}
