// Barra de topo própria do Meu site (modelo Kenlo). O menu lateral do LM Flow
// continua igual: isto é navegação DENTRO da página, na horizontal.
import { ChevronDown, ExternalLink, Globe } from 'lucide-react';
import {
  Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { GRUPOS, itensDoGrupo, telaInfo, type TelaId } from '@/features/siteBuilder/meuSiteMenu';

export interface MeuSiteBarraProps {
  tela: TelaId;
  aoIr: (tela: TelaId) => void;
  enderecoVisivel: string;
  urlDoSite: string;
  noAr: boolean;
  podeAnuncios: boolean;
}

export default function MeuSiteBarra({ tela, aoIr, enderecoVisivel, urlDoSite, noAr, podeAnuncios }: MeuSiteBarraProps) {
  const grupoAtual = telaInfo(tela).grupo;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-card px-6 py-2">
      <div className="flex min-w-0 items-center gap-2 py-2">
        <Globe className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate text-sm font-semibold">{enderecoVisivel}</span>
        {/* Fora do ar (Ativo ou Publicado desmarcado) o site mostra a página Em manutenção. */}
        <Badge variant={noAr ? 'default' : 'secondary'}>{noAr ? 'No ar' : 'Em manutenção'}</Badge>
      </div>
      <nav aria-label="Menu do Meu site" className="flex flex-1 flex-wrap items-center gap-1">
        {GRUPOS.map(g => {
          const ativo = grupoAtual === g.id;
          const cls = ativo ? 'bg-accent text-accent-foreground' : '';
          if (g.id === 'painel') {
            return (
              <Button key={g.id} variant="ghost" className={cls} onClick={() => aoIr('painel')}>
                {g.rotulo}
              </Button>
            );
          }
          const itens = itensDoGrupo(g.id, { podeAnuncios });
          return (
            <DropdownMenu key={g.id}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cls}>
                  {g.rotulo} <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[240px]">
                {itens.map(t => (
                  <DropdownMenuItem key={t.id} onSelect={() => aoIr(t.id)} className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-medium">{t.rotulo}</span>
                    <span className="text-xs text-muted-foreground">{t.dica}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </nav>
      <Button asChild>
        <a href={urlDoSite} target="_blank" rel="noreferrer">
          Ver site <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
        </a>
      </Button>
    </div>
  );
}
