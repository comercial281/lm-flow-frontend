import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import { CONSULTA_CELULAR } from '@/hooks/useCelular';

// Janela do bloco e do Início (redesenho do construtor, 16/10/2026): abre no
// meio da tela, por portal, então o mapa e o minimapa não são empurrados como
// eram com o painel lateral de 420px. Cabeçalho com o ícone, o nome e uma linha
// do que o bloco faz; campos no meio, com rolagem; Cancelar e Salvar no rodapé.
// Esc, o X e o clique fora chamam `onClose`, que o canvas transforma em
// "Descartar o que você mudou?" quando há rascunho (useSidePanel).
//
// É só a moldura: o rascunho, a validação e a pergunta de "descartar?" ficam
// com quem usa (FlowNodePanel, FlowTriggerPanel) e com o canvas.

/** O mesmo corte de celular do resto do app (`useCelular`). */
export const MOBILE_QUERY = CONSULTA_CELULAR;

interface Props {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Cor do quadradinho do ícone (a cor do grupo do bloco). */
  color?: string;
  onClose: () => void;
  /** Rodapé fixo (Cancelar / Salvar). */
  footer?: ReactNode;
  children: ReactNode;
  /** Pra testes e pro guia de construção: identifica a janela. */
  testId?: string;
  /** '2xl' para blocos com muito campo (Mandar WhatsApp). */
  size?: 'default' | '2xl';
}

export function FlowBlockDialog({
  title, description, icon: Icon, color, onClose, footer, children, testId, size = 'default',
}: Props) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className={size === '2xl' ? 'max-w-2xl' : undefined} data-testid={testId}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            {Icon && (
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: color || '#059669' }}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>
        <div className="py-2">{children}</div>
        {footer && <DialogFooter className="sm:justify-between">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
