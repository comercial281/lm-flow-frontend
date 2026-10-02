// src/pages/Customer/Properties/lista/EtiquetasDosFiltros.tsx
import { X } from 'lucide-react';

interface Props {
  itens: { chave: string; rotulo: string }[];
  aoTirar: (chave: string) => void;
  aoLimparTudo: () => void;
}

export default function EtiquetasDosFiltros({ itens, aoTirar, aoLimparTudo }: Props) {
  if (!itens.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {itens.map(i => (
        <button key={i.chave} type="button" onClick={() => aoTirar(i.chave)}
          aria-label={`Tirar o filtro ${i.rotulo}`} title={`Tirar o filtro ${i.rotulo}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15">
          {i.rotulo}<X className="h-3 w-3" />
        </button>
      ))}
      {itens.length > 1 && (
        <button type="button" onClick={aoLimparTudo} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">Limpar tudo</button>
      )}
    </div>
  );
}
