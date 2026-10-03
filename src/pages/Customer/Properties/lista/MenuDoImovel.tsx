// src/pages/Customer/Properties/lista/MenuDoImovel.tsx
import { MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/ds';
import type { Property } from '@/services/properties/propertiesService';
import { tipoDoImovel } from '@/features/properties/listingKind';

export interface AcoesDoImovel {
  editar: (p: Property) => void;
  fotos: (p: Property) => void;
  book: (p: Property) => void;
  site: (p: Property) => void;
  landing: (p: Property) => void;
  forca: (p: Property) => void;
  situacao: (p: Property) => void;
  mover: (p: Property) => void;
  excluir: (p: Property) => void;
}

export interface Permissoes { editar: boolean; excluir: boolean }

export default function MenuDoImovel({ p, acoes, permissoes, forca }: {
  p: Property; acoes: AcoesDoImovel; permissoes: Permissoes; forca?: number;
}) {
  const emp = tipoDoImovel(p) === 'development';
  // Fora do site (desmarcado, vendido, rascunho...) a página pública não existe.
  const noSite = p.published_on_site !== false && (p.status === 'active' || p.status === 'reserved');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Ações do ${p.code}`} title="Ações"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {permissoes.editar && <DropdownMenuItem onClick={() => acoes.editar(p)}>{emp ? 'Editar empreendimento' : 'Editar imóvel'}</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => acoes.fotos(p)}>Fotos e vídeos</DropdownMenuItem>
        {p.has_book && <DropdownMenuItem onClick={() => acoes.book(p)}>Ver book</DropdownMenuItem>}
        {noSite && <DropdownMenuItem onClick={() => acoes.site(p)}>Ver página no site</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => acoes.landing(p)}>Landing de anúncio</DropdownMenuItem>
        <DropdownMenuItem onClick={() => acoes.forca(p)}>
          {forca != null ? `Força do anúncio: ${forca}%` : 'Calcular força do anúncio'}
        </DropdownMenuItem>
        {permissoes.editar && <DropdownMenuItem onClick={() => acoes.situacao(p)}>Mudar situação…</DropdownMenuItem>}
        {permissoes.editar && <DropdownMenuItem onClick={() => acoes.mover(p)}>{emp ? 'Mover para Revenda' : 'Mover para Empreendimentos'}</DropdownMenuItem>}
        {permissoes.excluir && <DropdownMenuItem className="text-destructive" onClick={() => acoes.excluir(p)}>Excluir</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
