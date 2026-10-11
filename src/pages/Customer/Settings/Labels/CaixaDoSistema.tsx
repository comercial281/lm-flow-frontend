import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import LinhaEtiqueta from './LinhaEtiqueta';
import type { Label } from '@/types/settings';

const PASSO = 20;

interface CaixaDoSistemaProps {
  nome: string;
  frase: string;
  itens: Label[];
  abertaPorBusca?: boolean;
  onTrocarCor?: (label: Label) => void;
}

export default function CaixaDoSistema({ nome, frase, itens, abertaPorBusca, onTrocarCor }: CaixaDoSistemaProps) {
  const [aberta, setAberta] = useState(false);
  const [limite, setLimite] = useState(PASSO);
  const visivel = aberta || !!abertaPorBusca;
  const Chevron = visivel ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        aria-expanded={visivel}
        onClick={() => setAberta(!visivel)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
      >
        <span>{`${nome} · ${itens.length}`}</span>
        <Chevron className="h-4 w-4" />
      </button>
      {visivel && (
        <div className="border-t">
          <p className="px-3 py-2 text-xs text-muted-foreground">{frase}</p>
          {itens.slice(0, limite).map(l => (
            <LinhaEtiqueta key={l.id} label={l} travada onTrocarCor={onTrocarCor} />
          ))}
          {itens.length > limite && (
            <div className="p-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setLimite(n => n + PASSO)}>
                Mostrar mais
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
