// ── BOTÃO "MAIS AÇÕES" (gatilho do menu ⋮) ───────────────────────────────────
//
// Escolha do dono em 10/10/2026 (GLOSSARIO.md → As peças da casa, 15): todo
// menu de ações abre num ⋮ em pé (`EllipsisVertical`), botão `ghost` do tamanho
// de ícone (36 px) e com nome ("Mais ações"). Antes havia ⋯ deitado
// (`MoreHorizontal`) em 9 telas, a tabela da casa inclusa, e gatilhos de 20 a
// 32 px (`p-1`, `h-auto p-1`, `h-8 w-8 p-0`). A trava `menuDeitado` do
// `conferir-padrao` impede o ⋯ de voltar.
//
// Uso: `<DropdownMenuTrigger asChild><BotaoMaisAcoes /></DropdownMenuTrigger>`.
// `compacto` (32 px) é o mínimo, pra lugar apertado: coluna do quadro do funil,
// linha da tarefa, cartão do lead. `aria-label` próprio ("Opções de Visita")
// substitui o nome lido; a dica ao passar o mouse continua "Mais ações".
//
// O menu em si é o `DropdownMenuContent` do pacote, sem classe de cor. Excluir
// vai por último, depois de `DropdownMenuSeparator`, com `variant="destructive"`.
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { EllipsisVertical } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { cn } from '@/lib/utils';

export interface BotaoMaisAcoesProps extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  /** 32 px em vez de 36: só onde não cabe o tamanho normal. */
  compacto?: boolean;
}

const BotaoMaisAcoes = forwardRef<HTMLButtonElement, BotaoMaisAcoesProps>(
  ({ compacto, className, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Mais ações"
      title="Mais ações"
      {...props}
      className={cn(compacto && 'size-8', className)}
    >
      <EllipsisVertical className="h-4 w-4" aria-hidden />
    </Button>
  ),
);

BotaoMaisAcoes.displayName = 'BotaoMaisAcoes';

export default BotaoMaisAcoes;
