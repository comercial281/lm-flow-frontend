// src/pages/Customer/Properties/lista/MenuDoImovel.tsx
import { ArrowRightLeft, BookOpen, CheckCheck, CircleDot, Gauge, Globe, Images, Megaphone, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/ds';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import type { Property } from '@/services/properties/propertiesService';
import { tipoDoImovel } from '@/features/properties/listingKind';
import { vencido } from '@/features/properties/emDia';

export interface AcoesDoImovel {
  editar: (p: Property) => void;
  fotos: (p: Property) => void;
  book: (p: Property) => void;
  site: (p: Property) => void;
  landing: (p: Property) => void;
  forca: (p: Property) => void;
  situacao: (p: Property) => void;
  emDia: (p: Property) => void;
  mover: (p: Property) => void;
  excluir: (p: Property) => void;
}

export interface Permissoes { editar: boolean; excluir: boolean }

// Fora do site (desmarcado, vendido, rascunho...) a página pública não existe.
export const estaNoSite = (p: Property) =>
  p.published_on_site !== false && (p.status === 'active' || p.status === 'reserved');

export default function MenuDoImovel({ p, acoes, permissoes, forca }: {
  p: Property; acoes: AcoesDoImovel; permissoes: Permissoes; forca?: number;
}) {
  const emp = tipoDoImovel(p) === 'development';
  const noSite = estaNoSite(p);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BotaoMaisAcoes aria-label={`Ações do ${p.code}`} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {permissoes.editar && <DropdownMenuItem onClick={() => acoes.editar(p)}><Pencil className="h-4 w-4" />{emp ? 'Editar empreendimento' : 'Editar imóvel'}</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => acoes.fotos(p)}><Images className="h-4 w-4" />Fotos e vídeos</DropdownMenuItem>
        {p.has_book && <DropdownMenuItem onClick={() => acoes.book(p)}><BookOpen className="h-4 w-4" />Ver book</DropdownMenuItem>}
        {noSite && <DropdownMenuItem onClick={() => acoes.site(p)}><Globe className="h-4 w-4" />Ver página no site</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => acoes.landing(p)}><Megaphone className="h-4 w-4" />Landing de anúncio</DropdownMenuItem>
        <DropdownMenuItem onClick={() => acoes.forca(p)}>
          <Gauge className="h-4 w-4" />
          {forca != null ? `Força do anúncio: ${forca}%` : 'Calcular força do anúncio'}
        </DropdownMenuItem>
        {permissoes.editar && <DropdownMenuItem onClick={() => acoes.situacao(p)}><CircleDot className="h-4 w-4" />Mudar situação…</DropdownMenuItem>}
        {permissoes.editar && p.status === 'active' && vencido(p) && (
          <DropdownMenuItem onClick={() => acoes.emDia(p)}><CheckCheck className="h-4 w-4" />Marcar como em dia</DropdownMenuItem>
        )}
        {permissoes.editar && <DropdownMenuItem onClick={() => acoes.mover(p)}><ArrowRightLeft className="h-4 w-4" />{emp ? 'Mover para Revenda' : 'Mover para Empreendimentos'}</DropdownMenuItem>}
        {permissoes.excluir && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => acoes.excluir(p)}><Trash2 className="h-4 w-4" />Excluir</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
