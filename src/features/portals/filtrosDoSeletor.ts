// Filtros da lista "Imóveis" de um portal (10/11/2026, pedido da Mais que Imóveis).
// Espelha o "Filtrar imóveis" da Kenlo: corretor, tipo de anúncio e desatualizados,
// além da busca (que já cobre a referência) e do Todos / No portal / Fora.
// Tudo roda na tela: a lista já vem inteira (carregarAtivos), com captador,
// responsável e o prazo de "Desatualizado" de cada imóvel.
import type { Property } from '@/services/properties/propertiesService';
import { vencido } from '@/features/properties/emDia';

export type Mostrar = 'todos' | 'no_portal' | 'fora';

export interface FiltrosDoPortal {
  busca: string;
  mostrar: Mostrar;
  /** id do usuário: captador OU responsável, como o "Corretor" de Meus imóveis. */
  corretor: string;
  /** chave do tipo de anúncio; só casa com imóvel marcado nesse tipo. */
  tipo: string;
  desatualizados: boolean;
}

export const FILTROS_DO_PORTAL_VAZIOS: FiltrosDoPortal = {
  busca: '', mostrar: 'todos', corretor: '', tipo: '', desatualizados: false,
};

/** Algum filtro estreita a lista? Com filtro, "Selecionar/Desmarcar todos" age só no que aparece. */
export function temFiltro(f: FiltrosDoPortal): boolean {
  return !!f.busca.trim() || f.mostrar !== 'todos' || !!f.corretor || !!f.tipo || f.desatualizados;
}

type ImovelDoPortal = Pick<Property, 'id' | 'title' | 'code' | 'address_neighborhood' | 'address_city' |
  'captor' | 'responsible' | 'captor_id' | 'responsible_id' | 'stale_due_on'>;

export function filtrarImoveisDoPortal<T extends ImovelDoPortal>(
  imoveis: T[], publicacoes: Map<string, string>, f: FiltrosDoPortal, hoje?: string,
): T[] {
  const q = f.busca.trim().toLowerCase();
  return imoveis.filter(p => {
    const tipo = publicacoes.get(p.id);
    if (f.mostrar === 'no_portal' && tipo === undefined) return false;
    if (f.mostrar === 'fora' && tipo !== undefined) return false;
    if (f.tipo && tipo !== f.tipo) return false;
    if (f.corretor && (p.captor?.id ?? p.captor_id) !== f.corretor && (p.responsible?.id ?? p.responsible_id) !== f.corretor) return false;
    if (f.desatualizados && !vencido(p, hoje)) return false;
    if (!q) return true;
    return p.title.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.address_neighborhood ?? '').toLowerCase().includes(q) ||
      (p.address_city ?? '').toLowerCase().includes(q);
  });
}

/** Quem aparece no seletor de Corretor: captadores e responsáveis da lista, por nome. */
export function corretoresDaLista(imoveis: Pick<Property, 'captor' | 'responsible'>[]): { id: string; name: string }[] {
  const porId = new Map<string, string>();
  for (const p of imoveis) {
    for (const u of [p.captor, p.responsible]) if (u?.id && u.name) porId.set(u.id, u.name);
  }
  return [...porId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
