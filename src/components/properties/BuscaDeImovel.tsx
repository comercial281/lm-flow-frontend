import { useEffect, useState } from 'react';
import { Building2, Search, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import { propertiesService } from '@/services/properties/propertiesService';

export interface ImovelResumo {
  id: string;
  title: string;
  code: string;
}

const TEXTOS = {
  buscar: 'Buscar por título ou código',
  nenhum: 'Nenhum imóvel encontrado.',
  tirar: 'Tirar o imóvel',
  naoEncontrado: 'Imóvel não encontrado',
} as const;

// Quantos resultados a busca mostra. A lista rola; quem não achou refina o texto.
const POR_BUSCA = 20;

/**
 * Busca no catálogo inteiro de imóveis (título, código, bairro, cidade), no
 * servidor, a cada texto digitado. Sem lista pré-carregada: não tem teto de
 * imóveis e o recém-cadastrado aparece sem recarregar a página.
 */
export function BuscaDeImovel({ id, aoEscolher, disabled }: {
  id: string;
  aoEscolher: (p: ImovelResumo) => void;
  disabled?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<ImovelResumo[] | null>(null);

  useEffect(() => {
    if (!texto.trim()) { setLista(null); return; }
    let vivo = true;
    const espera = window.setTimeout(() => {
      propertiesService
        .list({ q: texto.trim(), per_page: POR_BUSCA })
        .then(r => { if (vivo) setLista((r.data ?? []).map(p => ({ id: String(p.id), title: p.title || p.code || 'Imóvel', code: p.code ?? '' }))); })
        .catch(() => { if (vivo) setLista([]); });
    }, 300);
    return () => { vivo = false; window.clearTimeout(espera); };
  }, [texto]);

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} value={texto} onChange={e => setTexto(e.target.value)} placeholder={TEXTOS.buscar} className="pl-9" disabled={disabled} />
      </div>
      {lista && (
        lista.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">{TEXTOS.nenhum}</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto rounded-md border border-border">
            {lista.map(p => (
              <li key={p.id}>
                <button type="button" className="w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50" onClick={() => aoEscolher(p)}>
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/** O imóvel escolhido, com a lixeira pra tirar. */
export function CartaoDoImovel({ imovel, aoTirar, disabled }: {
  imovel: ImovelResumo;
  aoTirar: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Building2 className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{imovel.title}</p>
        <p className="text-xs text-muted-foreground">{imovel.code}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={TEXTOS.tirar} onClick={aoTirar} disabled={disabled}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Campo de imóvel guardado só pelo id (ex.: Formulários do Meta): mostra o
 * cartão do imóvel vinculado (buscado pelo id) ou a busca quando está vazio.
 */
export function CampoDeImovel({ id, propertyId, aoMudar, disabled }: {
  id: string;
  propertyId: string;
  aoMudar: (propertyId: string) => void;
  disabled?: boolean;
}) {
  const [imovel, setImovel] = useState<ImovelResumo | null>(null);

  useEffect(() => {
    if (!propertyId) { setImovel(null); return; }
    if (imovel?.id === propertyId) return;
    let vivo = true;
    setImovel({ id: propertyId, title: '…', code: '' });
    propertiesService.get(propertyId)
      .then(p => { if (vivo) setImovel({ id: propertyId, title: p.title || p.code || 'Imóvel', code: p.code ?? '' }); })
      .catch(() => { if (vivo) setImovel({ id: propertyId, title: TEXTOS.naoEncontrado, code: '' }); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  if (propertyId && imovel) {
    return <CartaoDoImovel imovel={imovel} aoTirar={() => aoMudar('')} disabled={disabled} />;
  }
  return <BuscaDeImovel id={id} disabled={disabled} aoEscolher={p => { setImovel(p); aoMudar(p.id); }} />;
}
