import { Link } from 'react-router-dom';
import type { PortalProperty } from '../portalShared';
import type { AbaId, HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { atalhosDoSite } from '@/features/siteBuilder/public/maisBuscados';

/* Atalhos "Mais buscados": automáticos (tipo + bairro com mais imóveis) ou os
   que o cliente escreveu no Personalizar. Sem atalho, a faixa some. */

interface Props { home: HomeConfig; items: PortalProperty[]; tenant: string; abas: AbaId[] }

export default function HomeMaisBuscados({ home, items, tenant, abas }: Props) {
  const atalhos = atalhosDoSite(home, items, abas);
  if (atalhos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h2 className="font-[var(--display)] text-2xl font-semibold sm:text-3xl">Mais buscados</h2>
      <div className="mt-5 flex flex-wrap gap-2">
        {atalhos.map((a, i) => (
          <Link key={`${i}-${a.query}`} to={`/portal/${tenant}/imoveis${a.query ? `?${a.query}` : ''}`}
            className="rounded-full bg-white px-4 py-2 text-[14px] font-medium text-[var(--ink)] ring-1 ring-black/[0.08] transition-colors hover:text-[var(--brand)] hover:ring-[var(--brand)]">
            {a.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
