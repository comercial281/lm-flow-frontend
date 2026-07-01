import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

interface PortalProperty {
  id: string;
  code: string;
  title: string;
  transaction_type: string;
  property_type: string;
  display_price?: string;
  icon_summary?: {
    bedrooms?: number;
    bathrooms?: number;
    suites?: number;
    parking?: number;
    useful_area_m2?: number;
  };
  address?: { city?: string; neighborhood?: string };
  cover_url?: string | null;
  featured?: boolean;
  exclusive?: boolean;
}

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function PropertyCard({ tenant, p }: { tenant: string; p: PortalProperty }) {
  const s = p.icon_summary ?? {};
  const specs = [
    s.bedrooms ? `${s.bedrooms} dorm` : null,
    s.suites ? `${s.suites} suíte${s.suites > 1 ? 's' : ''}` : null,
    s.parking ? `${s.parking} vaga${s.parking > 1 ? 's' : ''}` : null,
    s.useful_area_m2 ? `${s.useful_area_m2} m²` : null,
  ].filter(Boolean);

  return (
    <Link
      to={`/imovel/${tenant}/${p.code}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
        {p.cover_url ? (
          <img
            src={p.cover_url}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">Sem foto</div>
        )}
        {p.exclusive && (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
            Exclusivo
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-2 text-base font-semibold text-neutral-900">{p.title}</h2>
        {(p.address?.neighborhood || p.address?.city) && (
          <p className="mt-1 text-sm text-neutral-500">
            {[p.address?.neighborhood, p.address?.city].filter(Boolean).join(' · ')}
          </p>
        )}
        {specs.length > 0 && (
          <p className="mt-2 text-sm text-neutral-600">{specs.join(' • ')}</p>
        )}
        <div className="mt-auto pt-3">
          <span className="text-lg font-bold text-emerald-700">{p.display_price || 'Consulte'}</span>
        </div>
      </div>
    </Link>
  );
}

/** Home/listagem pública INDEXÁVEL do portal imobiliário (Produto A). Lista os
 *  imóveis publicados do site; cada card leva pra página do imóvel. */
export default function PortalHomePage() {
  const { tenant } = useParams<{ tenant: string }>();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [items, setItems] = useState<PortalProperty[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!tenant) return;
      try {
        const base = import.meta.env.VITE_API_URL as string;
        const res = await fetch(`${base}/api/public/v1/site/properties?per_page=60`, {
          headers: { 'X-Tenant': tenant },
        });
        if (!res.ok) {
          if (active) setState('error');
          return;
        }
        const json = (await res.json()) as { data: PortalProperty[] };
        if (!active) return;
        setItems(json.data ?? []);
        document.title = 'Imóveis à venda';
        setMeta('description', 'Confira os imóveis disponíveis. Apartamentos, casas e lançamentos com fotos, ficha técnica e condições.');
        setMeta('robots', 'index,follow');
        setState('ok');
      } catch {
        if (active) setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [tenant]);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400">Carregando imóveis…</div>;
  }
  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500">
        Não foi possível carregar os imóveis.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold text-neutral-900">Imóveis à venda</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {items.length} imóvel{items.length !== 1 ? 'is' : ''} disponíve{items.length !== 1 ? 'is' : 'l'}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {items.length === 0 ? (
          <p className="py-16 text-center text-neutral-500">Nenhum imóvel publicado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <PropertyCard key={p.id} tenant={tenant!} p={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
