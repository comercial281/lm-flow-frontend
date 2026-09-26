/**
 * Mapa único endereço → permissão da Fase 1 (Cargos), task B4.
 *
 * `src/routes/index.tsx` continua com o `resource`/`action` LITERAL em cada
 * `<PermissionRoute>` (o `permissionRoutes.source.spec.ts` lê o próprio texto
 * do arquivo, então não dá para trocar por uma referência de variável ali).
 * Este arquivo existe para o MENU (task B5) não reinventar a chave de cada
 * tela: ele importa esta lista em vez de copiar `resource`/`action` na mão ao
 * lado de cada item — é exatamente o tipo de "duas fontes que divergem
 * caladas" que este produto já pagou caro por várias vezes (ver o histórico
 * de `CLAUDE.md`).
 *
 * Ao mexer numa chave aqui, mexa também no `<PermissionRoute>` da rota
 * correspondente em `index.tsx`, e vice-versa.
 */

export interface RoutePermission {
  /** Endereço como o menu (B5) e o navegador enxergam — sempre com barra
   * inicial, incluindo o prefixo `/automations` para as telas que vivem lá. */
  path: string;
  resource: string;
  action: string;
}

export const ROUTE_PERMISSIONS: readonly RoutePermission[] = [
  { path: '/ia-vendedora', resource: 'sales_agents', action: 'read' },
  { path: '/ia-vendedora/:id/assistente', resource: 'sales_agents', action: 'update' },
  { path: '/disparos', resource: 'broadcasts', action: 'read' },
  { path: '/automations/lead-automations', resource: 'lead_automation_rules', action: 'read' },
  { path: '/settings/lead-automations', resource: 'lead_automation_rules', action: 'read' },
  { path: '/automations/follow-ups', resource: 'followup_sequences', action: 'read' },
  { path: '/settings/follow-ups', resource: 'followup_sequences', action: 'read' },
  { path: '/settings/site-builder', resource: 'sites', action: 'read' },
  { path: '/settings/pixel-capi', resource: 'capi_configs', action: 'read' },
  { path: '/properties', resource: 'properties', action: 'read' },
  { path: '/properties/map', resource: 'properties', action: 'read' },
  { path: '/books', resource: 'properties', action: 'read' },
  { path: '/visits', resource: 'visits', action: 'read' },
  { path: '/proposals', resource: 'proposals', action: 'read' },
  { path: '/contracts', resource: 'contracts', action: 'read' },
  { path: '/property-capture-requests', resource: 'property_capture_requests', action: 'read' },
  { path: '/property-interests', resource: 'property_interests', action: 'read' },
  { path: '/settings/portals', resource: 'portals', action: 'read' },
  { path: '/settings/portals/:portalKey', resource: 'portals', action: 'read' },
  { path: '/automations/message-funnels', resource: 'message_funnels', action: 'read' },
  { path: '/settings/message-funnels', resource: 'message_funnels', action: 'read' },
  { path: '/automations/origem', resource: 'lead_ads_form_configs', action: 'read' },
  { path: '/automations/flow-builder', resource: 'flow_automations', action: 'read' },
  { path: '/automations/flow-builder/:id', resource: 'flow_automations', action: 'read' },
  // Rulings do controlador (X36/G5, task B4, 2026-09-26) — além da tabela do
  // brief: as chaves reais confirmadas no backend (PermissionRegistry) para
  // as telas de Lembretes WhatsApp e Formulários de Lead Ads.
  { path: '/automations/whatsapp-reminders', resource: 'whatsapp_reminders', action: 'read' },
  { path: '/settings/whatsapp-reminders', resource: 'whatsapp_reminders', action: 'read' },
  { path: '/automations/lead-ads-forms', resource: 'lead_ads_form_configs', action: 'read' },
  { path: '/settings/lead-ads-forms', resource: 'lead_ads_form_configs', action: 'read' },
] as const;

/** Busca rápida por endereço exato — o menu (B5) tende a ter o `href` pronto. */
export function permissionForPath(path: string): RoutePermission | undefined {
  return ROUTE_PERMISSIONS.find(entry => entry.path === path);
}
