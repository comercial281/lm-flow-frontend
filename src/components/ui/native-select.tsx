// Select nativo com a cara do design system.
//
// Por que continuar com `<select>` nativo em vez do Select do Radix: no celular
// o nativo abre o seletor do próprio sistema (a rodinha do iOS, a lista do
// Android), que é bem melhor de usar com o polegar do que uma lista flutuante
// dentro de um modal que já rola. O que estava ruim era só o VISUAL — altura
// destoando dos Inputs ao lado, sem anel de foco, e a setinha crua do sistema.
//
// `appearance-none` + a seta desenhada aqui é o que dá o acabamento; o
// `pr-8` reserva o espaço dela para o texto da opção não passar por baixo.
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NativeSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full appearance-none truncate rounded-md border border-input bg-background',
          'px-3 pr-8 text-sm shadow-xs outline-none transition-[color,box-shadow]',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {/* `pointer-events-none` para o clique atravessar e abrir o select. */}
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
      />
    </div>
  ),
);
NativeSelect.displayName = 'NativeSelect';
