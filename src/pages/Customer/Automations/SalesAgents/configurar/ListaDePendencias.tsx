// As pendências por passo, com "Corrigir" levando ao passo. Usada no passo 8.
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import type { PendenciaDoPasso } from '@/features/salesAgents/pendencias';
import { PASSOS, type NumeroDoPasso } from './passos';

export function ListaDePendencias({ pendencias, aoCorrigir }: { pendencias: PendenciaDoPasso[]; aoCorrigir: (p: NumeroDoPasso) => void }) {
  if (pendencias.length === 0) return null;
  return (
    <ul className="space-y-2">
      {pendencias.map((p) => (
        <li key={p.chave} className={`flex items-start gap-3 rounded-md border p-3 ${p.impedeLigar ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${p.impedeLigar ? 'text-red-500' : 'text-amber-500'}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-sm">{p.frase}</div>
            <div className="text-xs text-muted-foreground">{PASSOS.find((x) => x.numero === p.passo)?.titulo}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => aoCorrigir(p.passo as NumeroDoPasso)}>Corrigir</Button>
        </li>
      ))}
    </ul>
  );
}
