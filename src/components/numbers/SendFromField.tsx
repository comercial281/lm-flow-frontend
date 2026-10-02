import { useEffect, useId, useState } from 'react';
import { Label as UILabel } from '@/components/ui/ds';
import numbersService from '@/services/numbers/numbersService';
import {
  SEND_FROM_LABEL,
  SEND_FROM_LOAD_FAILED,
  SEND_FROM_OWNER,
  SEND_FROM_SPECIFIC_GROUP,
  fromSelectValue,
  missingSelection,
  missingSelectionLabel,
  numberOptionLabel,
  selectValue,
  sendFromAutoLabel,
  sendFromHint,
  showsOwnerOption,
  valueForScope,
  type SendFromValue,
  type SendNumbers,
  type SendNumbersScope,
  type SendNumbersState,
} from '@/features/numbers/sendFrom';
import { Seletor } from '@/components/base/Seletor';

// "ENVIAR PELO NÚMERO" (fase 2b.2): o campo da ação de mensagem das Automações
// de Lead e do funil de Follow-up. As palavras e as regras (inclusive o padrão
// de cada tela, E37) moram em features/numbers/sendFrom.ts; quem decide por
// onde sai é o servidor.
//
// Lista que não carregou NÃO troca a escolha: o número gravado continua
// selecionado (com o rótulo dizendo que a lista não veio) e salvar mantém.

interface SendFromFieldProps {
  scope: SendNumbersScope;
  value: SendFromValue;
  onChange: (next: SendFromValue) => void;
}

export default function SendFromField({ scope, value, onChange }: SendFromFieldProps) {
  const id = useId();
  const [data, setData] = useState<SendNumbers | null>(null);
  const [state, setState] = useState<SendNumbersState>('loading');

  useEffect(() => {
    let vivo = true;
    setState('loading');
    numbersService
      .sendNumbers(scope)
      .then(resposta => {
        if (!vivo) return;
        setData(resposta);
        setState('loaded');
      })
      .catch(() => {
        if (vivo) setState('failed');
      });
    return () => {
      vivo = false;
    };
  }, [scope]);

  const valor = valueForScope(value, scope);
  const numbers = data?.numbers ?? [];
  const ownerRule = data?.number_owner_rule ?? false;
  const atual = selectValue(valor);
  const faltando = missingSelection(valor, numbers);

  return (
    <div className="mt-2">
      <UILabel htmlFor={id}>{SEND_FROM_LABEL}</UILabel>
      <Seletor
        id={id}
        value={atual}
        onChange={e => onChange(fromSelectValue(e.target.value))}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">{sendFromAutoLabel(scope)}</option>
        {showsOwnerOption(scope) && <option value="owner">{SEND_FROM_OWNER}</option>}
        {(numbers.length > 0 || faltando) && (
          <optgroup label={SEND_FROM_SPECIFIC_GROUP}>
            {faltando && <option value={atual}>{missingSelectionLabel(state)}</option>}
            {numbers.map(n => (
              <option key={n.inbox_id} value={selectValue({ send_from: 'number', send_from_inbox_id: n.inbox_id })}>
                {numberOptionLabel(n, ownerRule)}
              </option>
            ))}
          </optgroup>
        )}
      </Seletor>
      <p className="text-xs text-muted-foreground mt-1">{sendFromHint(valor.send_from, scope)}</p>
      {state === 'failed' && <p className="text-xs text-amber-600 mt-1">{SEND_FROM_LOAD_FAILED}</p>}
    </div>
  );
}
