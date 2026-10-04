import React from 'react';
import { IMaskInput } from 'react-imask';
import { BR_PHONE_MASK, BR_PHONE_PLACEHOLDER } from '@/lib/brPhone';

interface BrPhoneInputProps {
  value: string;
  /** Recebe apenas os dígitos (ex.: "11999999999"), ou o texto com máscara se `entrega="mascarado"`. */
  onChange: (digits: string) => void;
  /**
   * O que o `onChange` devolve. `digitos` (padrão): só os números. `mascarado`:
   * o texto como aparece no campo, "(11) 3333-4444" — para quem grava o telefone
   * do jeito que ele é mostrado (Meu site › Dados de contato).
   */
  entrega?: 'digitos' | 'mascarado';
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Campo de telefone brasileiro com máscara (fixo ou celular).
 *
 * Aplica a máscara conforme o usuário digita e devolve somente os dígitos
 * via `onChange`. Sem seletor de país nem estilo próprio: herda o `className`
 * / `style` de cada formulário do Site Builder para não quebrar o visual.
 */
export const BrPhoneInput: React.FC<BrPhoneInputProps> = ({
  value,
  onChange,
  placeholder = BR_PHONE_PLACEHOLDER,
  entrega = 'digitos',
  ...rest
}) => (
  <IMaskInput
    mask={BR_PHONE_MASK}
    value={value}
    unmask={entrega === 'digitos'}
    onAccept={(valor: string) => onChange(valor)}
    inputMode="tel"
    autoComplete="tel"
    placeholder={placeholder}
    {...rest}
  />
);

export default BrPhoneInput;
