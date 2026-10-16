// O QUE O CORRETOR TEM PRA USAR NO CONSTRUTOR: número próprio e IA Vendedora.
//
// Vem pronto do servidor (`GET /flow_automations/personal_capabilities`), pela
// MESMA regra do envio da automação pessoal: só o número que a pessoa tem
// (nunca o compartilhado em que ela atende), que não esteja desconectado, e se
// ele tem IA Vendedora ligada. Enquanto carrega ou se der erro, vale "não tem"
// (o servidor decide de qualquer jeito).

import { useEffect, useState } from 'react';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';

export interface PersonalCapabilities {
  temNumero: boolean;
  temIA: boolean;
  /** Telefone do número próprio (pro "Sai pelo seu WhatsApp"). */
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
        const caps = await flowAutomationsService.personalCapabilities();
        const temNumero = caps?.tem_numero === true;
        if (alive) {
          setState({
            temNumero,
            temIA: temNumero && caps.tem_ia === true,
            principalPhone: temNumero ? caps.numero ?? null : null,
            loading: false,
          });
        }
      } catch {
        if (alive) setState({ ...NONE, loading: false });
      }
    })();
    return () => { alive = false; };
  }, [enabled]);

  return state;
}
