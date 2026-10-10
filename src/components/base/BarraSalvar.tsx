import { Button } from '@/components/ui/ds';
import { useOcupaCanto } from '@/components/support/cantoOcupado';

// A barra que aparece fixa no pé da página quando há alteração pendente
// (regra da Fase 3: campo espera o Salvar; ver hooks/useAlteracoesNaoSalvas).
// Ela é `sticky`, então precisa morar DENTRO do container que rola. Enquanto
// aparece, o Salvar ocupa o canto da bolinha do suporte, que vira a aba lateral.

export interface BarraSalvarProps {
  visivel: boolean;
  salvando: boolean;
  aoSalvar: () => void;
  aoDescartar: () => void;
}

export default function BarraSalvar({ visivel, salvando, aoSalvar, aoDescartar }: BarraSalvarProps) {
  useOcupaCanto(visivel);
  if (!visivel) return null;
  return (
    <div
      role="region"
      aria-label="Alterações não salvas"
      className="sticky bottom-0 z-20 mt-6 flex items-center justify-between gap-3 rounded-lg border border-sidebar-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur"
    >
      <span className="text-sm font-medium text-foreground">Alterações não salvas</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={aoDescartar} disabled={salvando}>
          Descartar
        </Button>
        <Button type="button" onClick={aoSalvar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
