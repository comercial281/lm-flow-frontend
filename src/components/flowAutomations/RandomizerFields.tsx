import { Plus, X } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import IconActionButton from '@/components/base/IconActionButton';
import { GrupoDaJanela } from '@/components/base/janela';
import {
  MAX_BRANCHES, MIN_BRANCHES, addBranch, branchLetter, branchesOf, percentProblem, percentTotal, removeBranch, setBranchPercent,
  splitConfigEvenly,
} from '@/features/flowAutomations/randomizer';
import type { FlowNodeConfig } from '@/types/flowAutomations';

// Miolo da janela do Randomizador. Uma linha por caminho, na mesma ordem do cartão
// no mapa: letra, %, a fatia e o remover. O total acompanha a digitação, e a janela
// só salva com 100% (readiness.ts).
export function RandomizerFields({ config, onChange, readOnly = false }: {
  config: FlowNodeConfig;
  onChange: (next: FlowNodeConfig) => void;
  /** Modo guiado: o corretor vê a divisão, mas quem muda é o gestor. */
  readOnly?: boolean;
}) {
  const branches = branchesOf(config);
  const problem = percentProblem(config);
  const canRemove = !readOnly && branches.length > MIN_BRANCHES;

  return (
    <div className="space-y-5">
      <GrupoDaJanela titulo="Caminhos">
        <ul className="grid gap-2">
          {branches.map((branch, index) => {
            const name = `Caminho ${branchLetter(index)}`;
            return (
              <li key={branch.id} className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground/80">
                  {branchLetter(index)}
                </span>
                <div className="relative w-20 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    aria-label={`% do ${name}`}
                    disabled={readOnly}
                    value={branch.percent}
                    onChange={e => onChange(setBranchPercent(config, branch.id, e.target.value))}
                    className="pr-7 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
                <span aria-hidden="true" className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(branch.percent, 100)}%` }} />
                </span>
                {canRemove && (
                  <IconActionButton
                    label={`Remover ${name}`}
                    icon={<X className="h-4 w-4 text-muted-foreground" />}
                    variant="ghost"
                    className="size-8 shrink-0"
                    onClick={() => onChange(removeBranch(config, branch.id))}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {/* As ações vêm depois dos campos: a janela abre com o foco na primeira %,
            e um Enter nunca desfaz a divisão que a pessoa montou. */}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={branches.length >= MAX_BRANCHES}
              onClick={() => onChange(addBranch(config))}
            >
              <Plus className="h-4 w-4" />
              Adicionar caminho
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(splitConfigEvenly(config))}>
              Dividir igual
            </Button>
          </div>
        )}
        {/* Sempre a mesma caixa, só muda a cor e o texto: se ela aparecesse só com a
            soma errada, a janela mudaria de altura e os campos pulariam embaixo do mouse. */}
        <div data-testid="total-dos-caminhos">
          <Aviso tom={problem ? 'atencao' : 'sucesso'} compacto>
            {problem ? `Total: ${percentTotal(config)}%. ${problem}` : 'Total: 100%'}
          </Aviso>
        </div>
      </GrupoDaJanela>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Cada lead cai em um caminho sorteado. Com poucos leads, a divisão fica aproximada.</p>
        <p>Sem nada ligado num caminho, o fluxo para aqui pra esse lead. Ligue pelo + de cada caminho, no mapa.</p>
      </div>
    </div>
  );
}
