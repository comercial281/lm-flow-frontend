import { ReactNode, forwardRef } from 'react';
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/ds';

export interface IconActionButtonProps {
  /** Texto do tooltip e do aria-label. */
  label: string;
  /** Ícone já dimensionado, ex.: <RefreshCw className="h-4 w-4" />. */
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost';
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  dataTour?: string;
  type?: 'button' | 'submit';
}

/**
 * Botão de ação compacto (só ícone) com tooltip estilizado.
 * Padrão dos toolbars de página: ações secundárias viram ícone,
 * a ação primária permanece com texto.
 */
const IconActionButton = forwardRef<HTMLButtonElement, IconActionButtonProps>(
  (
    {
      label,
      icon,
      onClick,
      disabled = false,
      variant = 'outline',
      className,
      side = 'bottom',
      dataTour,
      type = 'button',
    },
    ref,
  ) => {
    const button = (
      <Button
        ref={ref}
        type={type}
        variant={variant}
        size="icon"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={className}
        data-tour={dataTour}
      >
        {icon}
      </Button>
    );

    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Radix não dispara tooltip em elemento disabled — o span vira o trigger */}
            {disabled ? <span tabIndex={0} className="inline-flex">{button}</span> : button}
          </TooltipTrigger>
          <TooltipContent side={side}>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },
);

IconActionButton.displayName = 'IconActionButton';

export default IconActionButton;
