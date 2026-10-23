import { useEffect, useRef, useState } from 'react';
import numbersService from '@/services/numbers/numbersService';
import type { SendNumberOption, SendNumbersScope, SendNumbersState } from './sendFrom';

/**
 * Os números que a configuração pode escolher, buscados só quando `enabled`
 * vira verdadeiro (fluxo antigo que ninguém mexe não consulta nada). Lista que
 * falhou volta a `idle` quando `enabled` desliga: reabrir tenta de novo.
 * `idle` = ainda não pediu.
 */
export function useSendNumbers(scope: SendNumbersScope, enabled: boolean): {
  numbers: SendNumberOption[];
  ownerRule: boolean;
  state: SendNumbersState | 'idle';
} {
  const [numbers, setNumbers] = useState<SendNumberOption[]>([]);
  const [ownerRule, setOwnerRule] = useState(false);
  const [state, setState] = useState<SendNumbersState | 'idle'>('idle');
  // Resposta que chega depois de a tela fechar não mexe em nada.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (state === 'failed') setState('idle');
      return;
    }
    if (state !== 'idle') return;
    setState('loading');
    numbersService
      .sendNumbers(scope)
      .then(resposta => {
        if (!montado.current) return;
        setNumbers(resposta.numbers);
        setOwnerRule(resposta.number_owner_rule);
        setState('loaded');
      })
      .catch(() => {
        if (montado.current) setState('failed');
      });
  }, [enabled, state, scope]);

  return { numbers, ownerRule, state };
}
