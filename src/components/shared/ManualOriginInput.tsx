import { Input, Label } from '@/components/ui/ds';
import { Megaphone } from 'lucide-react';
import {
  MANUAL_ORIGIN_LABEL,
  MANUAL_ORIGIN_MAX_LENGTH,
  MANUAL_ORIGIN_PLACEHOLDER,
  MANUAL_ORIGIN_SUGGESTIONS,
} from '@/constants/manualLeadOrigin';

interface ManualOriginInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Rótulo do campo. Padrão: "Origem informada". */
  label?: string;
  /** Some com a linha de atalhos quando o espaço é apertado. */
  hideSuggestions?: boolean;
  id?: string;
}

/**
 * Campo de texto livre pra escrever de onde o lead veio quando ele é cadastrado
 * na mão ("Indicação", "Cliente de carteira"...). Os atalhos preenchem o campo,
 * mas não limitam: o corretor pode escrever qualquer coisa.
 */
export function ManualOriginInput({
  value,
  onChange,
  disabled = false,
  label = MANUAL_ORIGIN_LABEL,
  hideSuggestions = false,
  id = 'manual-origin',
}: ManualOriginInputProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        maxLength={MANUAL_ORIGIN_MAX_LENGTH}
        placeholder={MANUAL_ORIGIN_PLACEHOLDER}
        onChange={e => onChange(e.target.value)}
      />
      {!hideSuggestions && (
        <div className="flex flex-wrap gap-1.5">
          {MANUAL_ORIGIN_SUGGESTIONS.map(suggestion => (
            <button
              key={suggestion}
              type="button"
              disabled={disabled}
              onClick={() => onChange(suggestion)}
              className={`px-2 py-0.5 rounded-full border text-xs transition-colors disabled:opacity-50 ${
                value.trim().toLowerCase() === suggestion.toLowerCase()
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ManualOriginInput;
