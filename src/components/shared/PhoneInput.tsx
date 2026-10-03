import React, { useRef } from 'react';
import PhoneInputLib, { type Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './PhoneInput.css';
import { cn } from '@/lib/utils';
import { phoneDigits, toE164 } from '@/lib/phoneValue';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  /** Classes do campo de número, por cima do visual padrão (telas com fundo próprio). */
  inputClassName?: string;
  /**
   * Formato do valor que entra e sai:
   * - `e164` (padrão): `+5511999999999`
   * - `digits`: `5511999999999`, para as telas que guardam só os dígitos
   */
  valueFormat?: 'e164' | 'digits';
}

/**
 * PhoneInput Component
 *
 * Padronized phone input with:
 * - Country selector with flags
 * - Dynamic mask per country
 * - E.164 format output (e.g., +5531912345678), ou só dígitos com `valueFormat="digits"`
 * - Aceita valor salvo sem "+" e número antigo só com DDD (ganha o 55)
 * - Built-in validation
 *
 * @example
 * <PhoneInput
 *   value={phone}
 *   onChange={setPhone}
 *   defaultCountry="BR"
 *   error={!!errors.phone}
 * />
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  defaultCountry = 'BR',
  disabled = false,
  error = false,
  placeholder,
  className,
  id,
  inputClassName,
  valueFormat = 'e164',
}) => {
  // O que este campo acabou de emitir. Sem isso, no modo `digits` um número
  // pela metade com 10–11 dígitos ("5511987654") seria relido como DDD e
  // ganharia outro 55 enquanto a pessoa digita.
  const lastEmitted = useRef<{ out: string; e164: string } | null>(null);
  const shown =
    lastEmitted.current && lastEmitted.current.out === (value || '')
      ? lastEmitted.current.e164
      : toE164(value);

  return (
    <PhoneInputLib
      international
      defaultCountry={defaultCountry}
      value={shown}
      onChange={(next) => {
        const e164 = next || '';
        const out = valueFormat === 'digits' ? phoneDigits(e164) : e164;
        lastEmitted.current = { out, e164 };
        onChange(out);
      }}
      disabled={disabled}
      id={id}
      placeholder={placeholder}
      className={cn(
        'phone-input',
        error && 'phone-input-error',
        className
      )}
      countrySelectProps={{
        unicodeFlags: true,
        disabled,
      }}
      numberInputProps={{
        className: cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'md:text-sm',
          error && 'border-destructive focus-visible:ring-destructive',
          inputClassName
        ),
      }}
    />
  );
};

export default PhoneInput;
