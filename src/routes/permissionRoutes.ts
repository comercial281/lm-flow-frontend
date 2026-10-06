/**
 * Mapa único endereço → permissão de TODAS as rotas do CRM que conferem cargo
 * em `src/routes/index.tsx` (Fase 1 — Cargos).
 *
 * `index.tsx` continua com o `resource`/`action` LITERAL em cada
 * `<PermissionRoute>` (o `permissionRoutes.source.spec.ts` lê o próprio texto
 * do arquivo, então não dá para trocar por uma referência de variável ali).
 * Este arquivo existe para todo consumidor que precise da mesma informação
 * sem reinventar — hoje o MENU (task B5) — e, principalmente, para o próprio
 * `permissionRoutes.source.spec.ts` conferir nos DOIS sentidos que ele e o
 * `index.tsx` nunca divergem: é exatamente o tipo de "duas fontes que
 * divergem caladas" que este produto já pagou caro por várias vezes (ver o
 * histórico de `CLAUDE.md`).
 *
 * `path` é o valor LITERAL de `path="..."` em `index.tsx` — relativo (sem
 * barra inicial) para as telas aninhadas dentro de `<Route path="/automations">`,
 * absoluto para as demais. Use `hrefFor()` para o endereço completo que o
 * navegador (e o menu) enxerga.
 *
 * Ao mexer numa chave aqui, mexa também no `<PermissionRoute>` da rota
 * correspondente em `index.tsx` (ou vice-versa) — o spec de origem reprova a
 * divergência dos dois lados.
 */

export interface RoutePermission {
  path: string;
  resource: string;
  action: string;
  /** true quando a rota é filha de `<Route path="/automations">` em index.tsx
   * (path relativo, sem barra inicial) — o endereço completo leva o prefixo. */
  automationsChild?: true;
}

export const ROUTE_PERMISSIONS: readonly RoutePermission[] = [
  { path: '/contacts', resource: 'contacts', action: 'read' },
  { path: '/contacts/:contactId', resource: 'contacts', action: 'read' },
  { path: '/contacts/scheduled-actions', resource: 'contacts', action: 'read' },
  { path: '/pipelines', resource: 'pipelines', action: 'read' },
  { path: '/pipelines/:pipelineId', resource: 'pipelines', action: 'read' },
  { path: '/bolsao/listas', resource: 'bolsao_batches', action: 'read' },
  { path: '/bolsao', resource: 'bolsao_leads', action: 'read' },
  { path: '/equipe', resource: 'users', action: 'update' },
  { path: '/ia-vendedora', resource: 'sales_agents', action: 'read' },
  { path: '/disparos', resource: 'broadcasts', action: 'read' },
  { path: '/conversations', resource: 'conversations', action: 'read' },
  { path: '/conversations/:conversationId', resource: 'conversations', action: 'read' },

  // Filhas de /automations — path RELATIVO em index.tsx (o `<Route
  // path="/automations">` é quem dá o prefixo).
  { path: 'message-funnels', resource: 'message_funnels', action: 'read', automationsChild: true },
  { path: 'message-funnels/:id', resource: 'message_funnels', action: 'read', automationsChild: true },
  { path: 'flow-builder', resource: 'flow_automations', action: 'read', automationsChild: true },
  { path: 'flow-builder/:id', resource: 'flow_automations', action: 'read', automationsChild: true },
  { path: 'template-variables', resource: 'canned_responses', action: 'read', automationsChild: true },
  { path: 'origem', resource: 'lead_ads_form_configs', action: 'read', automationsChild: true },
  { path: 'lead-automations', resource: 'lead_automation_rules', action: 'read', automationsChild: true },
  { path: 'lead-ads-forms', resource: 'lead_ads_form_configs', action: 'read', automationsChild: true },
  { path: 'follow-ups', resource: 'followup_sequences', action: 'read', automationsChild: true },
  { path: 'follow-ups/:id', resource: 'followup_sequences', action: 'read', automationsChild: true },
  { path: 'whatsapp-reminders', resource: 'whatsapp_reminders', action: 'read', automationsChild: true },
  { path: 'roleta-config', resource: 'roleta_configs', action: 'read', automationsChild: true },
  // Roleta nova (chave `roleta_nova`): a página de uma roleta.
  { path: 'roleta-config/:id', resource: 'roleta_configs', action: 'read', automationsChild: true },

  { path: '/settings/account', resource: 'accounts', action: 'read' },
  { path: '/settings/teams/:teamId/add-users', resource: 'teams', action: 'create' },
  { path: '/settings/labels', resource: 'labels', action: 'read' },
  { path: '/settings/attributes', resource: 'custom_attribute_definitions', action: 'read' },
  { path: '/settings/template-variables', resource: 'canned_responses', action: 'read' },
  { path: '/settings/lead-automations', resource: 'lead_automation_rules', action: 'read' },
  { path: '/settings/lead-ads-forms', resource: 'lead_ads_form_configs', action: 'read' },
  { path: '/settings/site-builder', resource: 'sites', action: 'read' },
  { path: '/settings/macros', resource: 'macros', action: 'read' },
  { path: '/settings/whatsapp-reminders', resource: 'whatsapp_reminders', action: 'read' },
  { path: '/settings/pixel-capi', resource: 'capi_configs', action: 'read' },
  { path: '/settings/portals', resource: 'portals', action: 'read' },
  { path: '/settings/portals/:portalKey', resource: 'portals', action: 'read' },
  { path: '/settings/facebook', resource: 'lead_ads_form_configs', action: 'read' },
  { path: '/settings/roleta-config', resource: 'roleta_configs', action: 'read' },

  { path: '/dashboard-app/:appId', resource: 'integrations', action: 'read' },
  { path: '/bots', resource: 'bots', action: 'read' },
  { path: '/channels', resource: 'channels', action: 'read' },
  { path: '/channels/new', resource: 'channels', action: 'create' },
  { path: '/channels/:id/settings', resource: 'channels', action: 'read' },
  { path: '/settings/email-template-editor', resource: 'message_templates', action: 'create' },
  { path: '/reports', resource: 'reports', action: 'read' },
  { path: '/dashboard', resource: 'dashboard', action: 'read' },
  { path: '/properties', resource: 'properties', action: 'read' },
  { path: '/properties/map', resource: 'properties', action: 'read' },
  { path: '/properties/new', resource: 'properties', action: 'create' },
  { path: '/properties/:id/editar', resource: 'properties', action: 'update' },
  { path: '/property-owners', resource: 'properties', action: 'read' },
  { path: '/property-owners/:id', resource: 'properties', action: 'read' },
  { path: '/visits', resource: 'visits', action: 'read' },
  { path: '/proposals', resource: 'proposals', action: 'read' },
  { path: '/contracts', resource: 'contracts', action: 'read' },
  { path: '/property-capture-requests', resource: 'property_capture_requests', action: 'read' },
  { path: '/property-interests', resource: 'property_interests', action: 'read' },
] as const;

/** Endereço completo (o que o navegador e o menu enxergam). */
export function hrefFor(entry: RoutePermission): string {
  return entry.automationsChild ? `/automations/${entry.path}` : entry.path;
}

/** Busca por endereço completo (aceita `/automations/...` OU o path cru). */
export function permissionForPath(href: string): RoutePermission | undefined {
  return ROUTE_PERMISSIONS.find(entry => hrefFor(entry) === href || entry.path === href);
}
