import { useState } from 'react';
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
  /**
   * Só as pílulas, uma escolha: o texto livre aparece ao tocar em "Outra".
   * Com campo de texto + pílulas, não ficava claro se a pílula preenchia o
   * texto ou era uma segunda resposta (checklist da fase 4, Novo contato).
   */
  soPilulas?: boolean;
  id?: string;
}

const ehSugestao = (valor: string) =>
  MANUAL_ORIGIN_SUGGESTIONS.some(s => s.toLowerCase() === valor.trim().toLowerCase());

const classeDaPilula = (marcada: boolean) =>
  `px-2 py-0.5 rounded-full border text-xs transition-colors disabled:opacity-50 ${
    marcada
      ? 'border-primary bg-primary/10 text-primary font-medium'
      : 'border-border text-muted-foreground hover:bg-muted'
  }`;

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
  soPilulas = false,
  id = 'manual-origin',
}: ManualOriginInputProps) {
  // "Outra" fica aberta enquanto a pessoa digita, mesmo com o texto ainda vazio.
  const [outraAberta, setOutraAberta] = useState(false);

  if (soPilulas) {
    const outraMarcada = outraAberta || (!!value.trim() && !ehSugestao(value));
    return (
      <div className="grid gap-2">
        <Label id={`${id}-rotulo`} className="flex items-center gap-1.5">
          <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </Label>
        <div role="group" aria-labelledby={`${id}-rotulo`} className="flex flex-wrap gap-1.5">
          {MANUAL_ORIGIN_SUGGESTIONS.map(sugestao => {
            const marcada = !outraMarcada && value.trim().toLowerCase() === sugestao.toLowerCase();
            return (
              <button
                key={sugestao}
                type="button"
                aria-pressed={marcada}
                disabled={disabled}
                onClick={() => {
                  setOutraAberta(false);
                  // Tocar de novo na escolhida desfaz: origem é opcional.
                  onChange(marcada ? '' : sugestao);
                }}
                className={classeDaPilula(marcada)}
              >
                {sugestao}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={outraMarcada}
            disabled={disabled}
            onClick={() => {
              setOutraAberta(!outraMarcada);
              onChange('');
            }}
            className={classeDaPilula(outraMarcada)}
          >
            Outra
          </button>
        </div>
        {outraMarcada && (
          <Input
            id={id}
            aria-label="De onde veio"
            value={value}
            disabled={disabled}
            maxLength={MANUAL_ORIGIN_MAX_LENGTH}
            placeholder="Ex.: indicação do João"
            onChange={e => onChange(e.target.value)}
          />
        )}
      </div>
    );
  }

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
              className={classeDaPilula(value.trim().toLowerCase() === suggestion.toLowerCase())}
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
