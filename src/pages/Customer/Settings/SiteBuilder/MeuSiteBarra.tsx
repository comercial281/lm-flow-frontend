// Barra de topo própria do Meu site (modelo Kenlo). O menu lateral do LM Flow
// continua igual: isto é navegação DENTRO da página, na horizontal.
import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Copy, ExternalLink, Globe, Loader2, X } from 'lucide-react';
import {
  Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input,
} from '@/components/ui/ds';
import { GRUPOS, itensDoGrupo, telaInfo, type TelaId } from '@/features/siteBuilder/meuSiteMenu';

export interface MeuSiteBarraProps {
  tela: TelaId;
  aoIr: (tela: TelaId) => void;
  enderecoVisivel: string;
  /** Domínio próprio ativo, ou o endereço lmflow (`/portal/<cliente>`). */
  urlDoSite: string;
  noAr: boolean;
  podeAnuncios: boolean;
  /**
   * Em manutenção, "Ver site" vira "Ver prévia": pede um link de 24 h ao
   * servidor e devolve o endereço com `?previa=`.
   */
  aoPedirPrevia?: () => Promise<string>;
}

export default function MeuSiteBarra({
  tela, aoIr, enderecoVisivel, urlDoSite, noAr, podeAnuncios, aoPedirPrevia,
}: MeuSiteBarraProps) {
  const grupoAtual = telaInfo(tela).grupo;
  const [gerando, setGerando] = useState(false);
  const [linkDaPrevia, setLinkDaPrevia] = useState<string | null>(null);
  const comPrevia = !noAr && !!aoPedirPrevia;

  const verPrevia = async () => {
    if (!aoPedirPrevia) return;
    // A aba abre AGORA, no clique: aberta depois da resposta do servidor, o
    // navegador a trata como janela não pedida e bloqueia.
    const aba = window.open('', '_blank');
    setGerando(true);
    try {
      const url = await aoPedirPrevia();
      setLinkDaPrevia(url);
      if (aba) {
        aba.opener = null;
        aba.location.href = url;
      }
    } catch {
      aba?.close();
      toast.error('Não deu para gerar o link da prévia. Tente de novo.');
    } finally {
      setGerando(false);
    }
  };

  const copiar = async () => {
    if (!linkDaPrevia) return;
    try {
      await navigator.clipboard.writeText(linkDaPrevia);
      toast.success('Link copiado');
    } catch {
      toast.error('Não deu para copiar. Selecione o link e copie.');
    }
  };

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
      {comPrevia ? (
        <Button onClick={verPrevia} disabled={gerando}>
          {gerando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
          Ver prévia <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
        </Button>
      ) : (
        <Button asChild>
          <a href={urlDoSite} target="_blank" rel="noreferrer">
            Ver site <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
          </a>
        </Button>
      )}
      {comPrevia && linkDaPrevia && (
        <div className="basis-full rounded-lg border bg-muted/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <p role="status" className="text-sm">Esse link vale 24 horas. Pode mandar pro dono aprovar.</p>
            <Button variant="ghost" size="sm" aria-label="Fechar aviso" onClick={() => setLinkDaPrevia(null)}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={linkDaPrevia} aria-label="Link da prévia" className="h-11 text-base"
              onFocus={e => e.currentTarget.select()} />
            <Button variant="outline" className="shrink-0" onClick={copiar}>
              <Copy className="mr-1.5 h-4 w-4" aria-hidden /> Copiar link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
