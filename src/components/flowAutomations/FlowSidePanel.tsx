import { useId, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import IconActionButton from '@/components/base/IconActionButton';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

// Painel lateral do construtor (sprint 4, spec 04/10/2026, A.4): fica à direita
// do canvas, com ~420px, no lugar da janela que tampava tudo. Cabeçalho com o
// ícone, o nome e uma linha do que o bloco faz; campos no meio, com rolagem;
// Cancelar e Salvar num rodapé que não rola. No celular (< 768px) vira tela
// cheia por cima do canvas (A.5).
//
// É só a moldura: o rascunho, a validação e a pergunta de "descartar?" ficam
// com quem usa (FlowNodePanel, FlowTriggerPanel) e com o canvas.

export const MOBILE_QUERY = '(max-width: 767px)';

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
  /** Pra testes e pro guia de construção: identifica o painel. */
  testId?: string;
}

export function FlowSidePanel({ title, description, icon: Icon, color, onClose, footer, children, testId }: Props) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const titleId = useId();
  return (
    <aside
      role="dialog"
      aria-labelledby={titleId}
      data-testid={testId}
      data-layout={isMobile ? 'tela-cheia' : 'lateral'}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className={cn(
        'flex flex-col bg-background',
        isMobile
          ? 'fixed inset-0 z-50 w-full'
          : 'relative h-full w-[420px] max-w-[45vw] shrink-0 border-l border-border shadow-[-4px_0_12px_-8px_rgba(0,0,0,0.15)]',
      )}
    >
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
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
          <h2 id={titleId} className="text-base font-semibold leading-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <IconActionButton
          label="Fechar o painel"
          icon={<X className="h-4 w-4" />}
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
        />
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer && (
        <footer className="flex items-center justify-between gap-2 border-t border-border bg-background px-4 py-3">
          {footer}
        </footer>
      )}
    </aside>
  );
}
