import { useEffect, useState } from 'react';
import numbersService from '@/services/numbers/numbersService';
import type { SendNumberOption, SendNumbersScope, SendNumbersState } from './sendFrom';

/**
 * Os números que a configuração pode escolher, buscados UMA vez, só quando
 * `enabled` vira verdadeiro (fluxo antigo que ninguém mexe não consulta nada).
 * `idle` = ainda não pediu.
 */
export function useSendNumbers(scope: SendNumbersScope, enabled: boolean): {
  numbers: SendNumberOption[];
  state: SendNumbersState | 'idle';
} {
  const [numbers, setNumbers] = useState<SendNumberOption[]>([]);
  const [state, setState] = useState<SendNumbersState | 'idle'>('idle');

  useEffect(() => {
    if (!enabled || state !== 'idle') return;
    setState('loading');
    numbersService
      .sendNumbers(scope)
      .then(resposta => {
        setNumbers(resposta.numbers);
        setState('loaded');
      })
      .catch(() => setState('failed'));
  }, [enabled, state, scope]);

  return { numbers, state };
}
