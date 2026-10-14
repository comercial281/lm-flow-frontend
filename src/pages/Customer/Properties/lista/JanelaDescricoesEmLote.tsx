// src/pages/Customer/Properties/lista/JanelaDescricoesEmLote.tsx
import { Loader2, Wand2 } from 'lucide-react';
import {
  Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import { PROPERTY_TYPE_LABELS, type Property } from '@/services/properties/propertiesService';

export type ResultadoDaDescricao = {
  id: string; status: 'ok' | 'error'; headline?: string; description?: string; error?: string;
};

// Escolher imóveis e gerar a descrição de todos de uma vez. O estado fica na
// página (quem abre a janela zera a seleção); aqui só se desenha e se avisa.
export default function JanelaDescricoesEmLote({ aberta, aoMudarAberta, imoveis, selecionados, aoMudarSelecao, gerando, resultados, aoGerar }: {
  aberta: boolean;
  aoMudarAberta: (aberta: boolean) => void;
  imoveis: Property[];
  selecionados: Set<string>;
  aoMudarSelecao: (selecionados: Set<string>) => void;
  gerando: boolean;
  resultados: ResultadoDaDescricao[] | null;
  aoGerar: () => void;
}) {
  const alternar = (id: string) => {
    const proximo = new Set(selecionados);
    if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
    aoMudarSelecao(proximo);
  };
  const todos = selecionados.size === imoveis.length;

  return (
    <Dialog open={aberta} onOpenChange={open => { if (!gerando) aoMudarAberta(open); }}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Geração de descrições em lote
          </DialogTitle>
          <DialogDescription>
            Selecione os imóveis e gere descrições com IA para todos de uma vez.
          </DialogDescription>
        </DialogHeader>

        {!resultados ? (
          <>
            <Aviso tom="info" compacto>Imóvel que já tem descrição ganha uma nova no lugar.</Aviso>
            <div className="flex items-center justify-between mb-2 mt-1">
              <span className="text-xs text-muted-foreground">{selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}</span>
              <Button
                type="button" variant="ghost" size="sm"
                onClick={() => aoMudarSelecao(todos ? new Set() : new Set(imoveis.map(p => p.id)))}
              >
                {todos ? 'Desselecionar todos' : 'Selecionar todos'}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {imoveis.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={selecionados.has(p.id)}
                    onCheckedChange={() => alternar(p.id)}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.code} · {PROPERTY_TYPE_LABELS[p.property_type] ?? p.property_type}</p>
                  </div>
                  {p.description && <span className="text-xs text-muted-foreground flex-shrink-0">já tem descrição</span>}
                </label>
              ))}
            </div>
            <DialogFooter className="mt-3">
              <Button variant="outline" onClick={() => aoMudarAberta(false)}>Cancelar</Button>
              <Button onClick={aoGerar} disabled={gerando || selecionados.size === 0}>
                {gerando
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                  : <><Wand2 className="h-4 w-4 mr-2" />Gerar {selecionados.size > 0 ? selecionados.size : ''} descriç{selecionados.size !== 1 ? 'ões' : 'ão'}</>
                }
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 mt-1 pr-1">
              {resultados.map(r => {
                const prop = imoveis.find(p => p.id === r.id);
                return (
                  <Aviso
                    key={r.id}
                    tom={r.status === 'ok' ? 'sucesso' : 'erro'}
                    titulo={<span className="block truncate">{prop?.title ?? r.id}</span>}
                  >
                    {r.status === 'ok' && r.description && (
                      <p className="text-xs line-clamp-2">{r.description}</p>
                    )}
                    {r.status === 'error' && (
                      <p className="text-xs">{r.error}</p>
                    )}
                  </Aviso>
                );
              })}
            </div>
            <DialogFooter className="mt-3">
              <Button onClick={() => aoMudarAberta(false)}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
