// Antes de 01/10/2026, Clientes e IA Vendedora eram telas com abas de ESTADO
// (`?tab=`). Agora cada aba é uma rota e várias mudaram de item. Link salvo com
// o `?tab=` antigo cai aqui e vai pra aba nova. Aba que saiu cai na tela-base.

type Base = '/admin/clientes' | '/admin/agentes';

const CLIENTES: Record<string, string | null> = {
  clients: null,
  'leads-ao-vivo': '/admin/leads-ao-vivo',
  numeros: '/admin/clientes/numeros',
  logs: '/admin/usuarios/logs',
  atividade: '/admin/usuarios/logs',
  metrics: '/admin/usuarios',
  'archived-features': '/admin/plataforma/menus-arquivados',
  'sugestoes-bugs': '/admin/plataforma/sugestoes-e-bugs',
  dashboard: '/admin',
};

const AGENTES: Record<string, string | null> = {
  agentes: null,
  cerebro: '/admin/agentes/conhecimento',
  principios: '/admin/agentes/conhecimento',
  aperfeicoamento: '/admin/agentes/conhecimento',
  resultados: '/admin/agentes/dashboard',
};

export function destinoDaAbaAntiga(base: Base, tab: string | null): string | null {
  if (!tab) return null;
  const mapa = base === '/admin/clientes' ? CLIENTES : AGENTES;
  return tab in mapa ? mapa[tab] : base;
}
