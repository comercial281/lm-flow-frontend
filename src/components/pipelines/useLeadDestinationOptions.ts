import { useEffect, useState } from 'react';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { roletaConfigService, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { usersService } from '@/services/users';
import { labelsService } from '@/services/contacts/labelsService';
import type { User } from '@/types/users';

export interface DestinationOpt {
  id: string;
  label: string;
}

/** `null` = a leitura foi recusada (cargo sem acesso): aquele seletor some. */
export interface LeadDestinationOptions {
  pipelines: DestinationOpt[] | null;
  roletas: RoletaConfig[] | null;
  users: User[] | null;
  labels: DestinationOpt[] | null;
}

/**
 * As listas do bloco "Destino do lead" (portal e site), lidas em paralelo e
 * de forma independente: a que falhar só esconde o próprio seletor —
 * `allSettled` para uma recusa não derrubar as outras. Corretor desativado não
 * é oferecido.
 */
export function useLeadDestinationOptions({ withLabels = false }: { withLabels?: boolean } = {}): LeadDestinationOptions {
  const [options, setOptions] = useState<LeadDestinationOptions>({ pipelines: null, roletas: null, users: null, labels: null });

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [pRes, rRes, uRes, lRes] = await Promise.allSettled([
        pipelinesService.getPipelines({ include_items: false }),
        roletaConfigService.getAll(),
        usersService.getUsers({ per_page: 100 }),
        withLabels ? labelsService.getLabels() : Promise.resolve(null),
      ]);
      if (!ativo) return;
      setOptions({
        pipelines: pRes.status === 'fulfilled'
          ? ((pRes.value?.data ?? []) as Array<{ id: string; name: string }>).map(p => ({ id: String(p.id), label: p.name }))
          : null,
        roletas: rRes.status === 'fulfilled' ? (rRes.value ?? []) : null,
        users: uRes.status === 'fulfilled' ? (uRes.value?.data ?? []).filter(u => !u.deactivated) : null,
        labels: withLabels && lRes.status === 'fulfilled' && lRes.value
          ? ((lRes.value.data ?? []) as Array<{ id: string | number; title: string }>).map(l => ({ id: String(l.id), label: l.title }))
          : null,
      });
    })();
    return () => { ativo = false; };
  }, [withLabels]);

  return options;
}
