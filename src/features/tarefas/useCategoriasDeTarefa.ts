import { useEffect, useState } from 'react';
import { listOptionsService, type ListOption } from '@/services/listOptions/listOptionsService';

/**
 * Fonte única das categorias de tarefa: a lista editável `task_categories`
 * (Minha imobiliária › Listas). `ativas` são as que a pessoa pode escolher;
 * `todas` inclui as arquivadas, só pra dar nome a tarefa antiga.
 * Uma leitura por montagem; se falhar, listas vazias e a tela segue.
 */
export function useCategoriasDeTarefa() {
  const [todas, setTodas] = useState<ListOption[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    listOptionsService
      .list('task_categories', { includeInactive: true })
      .then(r => { if (vivo) setTodas(Array.isArray(r) ? r : []); })
      .catch(() => { if (vivo) setTodas([]); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const ativas = todas.filter(o => o.active).sort((a, b) => a.position - b.position);
  return { ativas, todas, carregando };
}
