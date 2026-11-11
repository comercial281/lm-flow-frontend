// Unidades plugadas no condomínio: cada uma abre o cadastro dela.
// Plugar e tirar é no cadastro da unidade (Localização), não aqui.
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/base';
import type { CondominiumUnit } from '@/services/condominiums/condominiumsService';
import { rotuloDaSituacao, type ListingKind } from '@/features/properties/listingKind';

const TIPOS: readonly string[] = ['development', 'resale', 'auction'];
const tipoDa = (u: CondominiumUnit): ListingKind => (TIPOS.includes(u.listing_kind) ? u.listing_kind as ListingKind : 'resale');

const linkDaUnidade = (id: string) => `/properties/${id}/editar`;

export default function SecaoUnidades({ unidades, aoAbrir }: {
  unidades: CondominiumUnit[];
  /** Quem chama pergunta antes de sair se há alteração não salva. */
  aoAbrir: (caminho: string) => void;
}) {
  if (!unidades.length) {
    return (
      <div className="mt-4">
        <EmptyState tamanho="compacto" title="Nenhuma unidade plugada. Plugue pelo cadastro do imóvel, em Localização." />
      </div>
    );
  }
  const abrir = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    // Ctrl/⌘ + clique abre noutra aba, como todo link.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    aoAbrir(linkDaUnidade(id));
  };
  return (
    <ul className="mt-4 divide-y rounded-lg border">
      {unidades.map(u => (
        <li key={u.id}>
          <Link
            to={linkDaUnidade(u.id)}
            onClick={e => abrir(e, u.id)}
            className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted"
          >
            <span className="w-20 shrink-0 font-medium">{u.code || '—'}</span>
            <span className="min-w-0 flex-1 truncate">{u.title}</span>
            <span className="shrink-0 text-muted-foreground">{rotuloDaSituacao(tipoDa(u), u.status)}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
