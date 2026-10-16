// O QUE O CORRETOR TEM PRA USAR NO CONSTRUTOR: número próprio e IA Vendedora.
//
// `temNumero`: algum número dele que não esteja confirmado como desconectado
// (o servidor trata "desconectado" como sem número). `temIA`: o cartão do
// número principal lista IA Vendedora ligada (Numbers::Card#ai). Enquanto
// carrega ou se der erro, vale "não tem" (o servidor decide de qualquer jeito).

import { useEffect, useState } from 'react';
import numbersService from '@/services/numbers/numbersService';
import type { OwnedNumber } from '@/features/numbers/types';

export interface PersonalCapabilities {
  temNumero: boolean;
  temIA: boolean;
  /** Telefone do número principal (pro "Sai pelo seu WhatsApp"). */
  principalPhone: string | null;
  loading: boolean;
}

const NONE: PersonalCapabilities = { temNumero: false, temIA: false, principalPhone: null, loading: true };

export function usePersonalCapabilities(enabled: boolean): PersonalCapabilities {
  const [state, setState] = useState<PersonalCapabilities>(NONE);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      try {
        const mine = await numbersService.myNumbers();
        const usable = mine.numbers.filter((n: OwnedNumber) => n.connection !== 'disconnected');
        const principal = usable.find(n => n.principal) ?? usable[0] ?? null;
        let temIA = false;
        if (principal) {
          try {
            const card = await numbersService.numberCard(principal.inbox_id);
            temIA = (card.ai ?? []).length > 0;
          } catch { /* sem cartão = sem IA */ }
        }
        if (alive) setState({ temNumero: usable.length > 0, temIA, principalPhone: principal?.phone ?? null, loading: false });
      } catch {
        if (alive) setState({ ...NONE, loading: false });
      }
    })();
    return () => { alive = false; };
  }, [enabled]);

  return state;
}
