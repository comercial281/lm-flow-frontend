// ── GESTÃO DE PROPRIETÁRIOS NO MENU (Imóveis entrega 3, 03/10/2026) ─────────
// O cargo só filtra a leitura (properties.read). O resto depende de dado:
//   - quem gere (properties.update) sempre vê o item;
//   - o corretor só vê com pelo menos um proprietário liberado para ele;
//   - a bolinha acende com captação nova não vista (quem lê captações).
import { useEffect, useState } from 'react';
import { useCan } from '@/hooks/useCan';
import { propertyOwnersService } from '@/services/propertyOwners/propertyOwnersService';
import type { MenuItem } from '@/components/layout/config/menuItems';
import { useCaptacoesNovas } from './useCaptacoesNovas';

export const ROTA_PROPRIETARIOS = '/property-owners';

export interface EstadoDosProprietarios { visivel: boolean; marcador: boolean }

/** Tira o item quando não é visível e anota a bolinha nele. Seção sem o item passa intacta. */
export function aplicarProprietariosNoMenu<T extends { itens: MenuItem[] }>(secoes: T[], estado: EstadoDosProprietarios): T[] {
  return secoes.map(secao => {
    if (!secao.itens.some(i => i.href === ROTA_PROPRIETARIOS)) return secao;
    const itens = estado.visivel
      ? secao.itens.map(i => (i.href === ROTA_PROPRIETARIOS ? { ...i, marcador: estado.marcador } : i))
      : secao.itens.filter(i => i.href !== ROTA_PROPRIETARIOS);
    return { ...secao, itens };
  });
}

export function useProprietariosNoMenu(): EstadoDosProprietarios {
  const can = useCan();
  const podeGerir = can('properties', 'update');
  const podeLer = can('properties', 'read');
  const [total, setTotal] = useState(0);

  // Uma vez por sessão: proprietário liberado para o corretor não muda a toda hora.
  useEffect(() => {
    if (podeGerir || !podeLer) return;
    let cancelado = false;
    propertyOwnersService.count()
      .then(n => { if (!cancelado) setTotal(n); })
      .catch(() => { if (!cancelado) setTotal(0); });
    return () => { cancelado = true; };
  }, [podeGerir, podeLer]);

  const { tem } = useCaptacoesNovas(can('property_capture_requests', 'read'));
  return { visivel: podeGerir || total > 0, marcador: tem };
}
