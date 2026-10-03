import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ROUTE_PERMISSIONS } from './permissionRoutes';

// As rotas moram num arquivo de 1.300 linhas; montar o roteador inteiro num
// teste puxaria todas as telas. Lê o código-fonte, como o spec do convite.
//
// Blocos de comentário JSX (`{/* ... */}`) são removidos ANTES de qualquer
// busca: há rotas comentadas no arquivo (ex.: /automation, /reports/overview)
// com `path="..."` e `<PermissionRoute>` dentro do comentário — sem isso elas
// contariam como rota real e o segundo describe (que varre o arquivo inteiro)
// as acusaria de "órfã" ou pior, as trataria como protegidas de verdade.
const rawSrc = readFileSync(resolve(__dirname, 'index.tsx'), 'utf8');
const src = rawSrc.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const trecho = (path: string) => {
  const i = src.indexOf(`path="${path}"`);
  expect(i, `rota ${path} não encontrada`).toBeGreaterThan(-1);
  const fim = src.indexOf('<Route', i + 1);
  return src.slice(i, fim === -1 ? undefined : fim);
};

describe('toda rota do CRM confere o cargo', () => {
  it.each([
    ['/ia-vendedora', 'sales_agents', 'read'],
    ['/ia-vendedora/:id/assistente', 'sales_agents', 'update'],
    ['/disparos', 'broadcasts', 'read'],
    ['/settings/lead-automations', 'lead_automation_rules', 'read'],
    ['lead-automations', 'lead_automation_rules', 'read'],
    ['follow-ups', 'flow_automations', 'read'],
    ['follow-ups/:id', 'flow_automations', 'read'],
    ['/settings/site-builder', 'sites', 'read'],
    ['/settings/pixel-capi', 'capi_configs', 'read'],
    ['/properties', 'properties', 'read'],
    ['/properties/map', 'properties', 'read'],
    ['/books', 'properties', 'read'],
    ['/visits', 'visits', 'read'],
    ['/proposals', 'proposals', 'read'],
    ['/contracts', 'contracts', 'read'],
    ['/property-capture-requests', 'property_capture_requests', 'read'],
    ['/property-interests', 'property_interests', 'read'],
    ['/settings/portals', 'portals', 'read'],
    ['/settings/portals/:portalKey', 'portals', 'read'],
    ['/settings/facebook', 'lead_ads_form_configs', 'read'],
    ['message-funnels', 'message_funnels', 'read'],
    ['/settings/message-funnels', 'message_funnels', 'read'],
    ['origem', 'lead_ads_form_configs', 'read'],
    ['flow-builder', 'flow_automations', 'read'],
    ['flow-builder/:id', 'flow_automations', 'read'],
    // Rulings do controlador (X36/G5, 2026-09-26) — além da tabela do brief;
    // chave confirmada no backend via PermissionRegistry.
    ['whatsapp-reminders', 'whatsapp_reminders', 'read'],
    ['/settings/whatsapp-reminders', 'whatsapp_reminders', 'read'],
    ['lead-ads-forms', 'lead_ads_form_configs', 'read'],
    ['/settings/lead-ads-forms', 'lead_ads_form_configs', 'read'],
  ])('%s exige %s.%s', (path, resource, action) => {
    expect(trecho(path)).toContain(`<PermissionRoute resource="${resource}" action="${action}">`);
  });
});

// /conversations e /conversations/:conversationId NÃO têm o `<PermissionRoute>`
// colado no `path="..."` delas: as duas apontam para o MESMO elemento
// compartilhado (`const ChatRouteElement = (<PermissionRoute ...>)`), então
// `trecho()` nunca as alcança. Tratadas à parte, nos dois describes abaixo.
const SHARED_ELEMENT_PATHS = ['/conversations', '/conversations/:conversationId'];
const chatRouteElementBlock = () => {
  const i = src.indexOf('const ChatRouteElement');
  expect(i, 'ChatRouteElement não encontrado em index.tsx').toBeGreaterThan(-1);
  const fim = src.indexOf(');', i);
  return src.slice(i, fim === -1 ? undefined : fim);
};

describe('permissionRoutes.ts não diverge de index.tsx (mapa único da Fase 1 Cargos)', () => {
  // Direção 1 — mapa → rota: toda entrada de ROUTE_PERMISSIONS tem, em
  // index.tsx, o MESMO <PermissionRoute resource=... action=...> que ela
  // documenta. Pega o caso de alguém editar a chave só num dos dois lados.
  it.each(ROUTE_PERMISSIONS)(
    'mapa → rota: "$path" exige $resource.$action em index.tsx',
    ({ path, resource, action }) => {
      const trechoDoArquivo = SHARED_ELEMENT_PATHS.includes(path)
        ? chatRouteElementBlock()
        : trecho(path);
      expect(
        trechoDoArquivo,
        `a rota "${path}" não usa <PermissionRoute resource="${resource}" action="${action}"> em index.tsx`,
      ).toContain(`<PermissionRoute resource="${resource}" action="${action}">`);
    },
  );

  // Direção 2 — rota → mapa: toda rota de index.tsx que confere cargo (um
  // <PermissionRoute resource=... action=...> colado no path="...", ou o
  // ChatRouteElement compartilhado) tem entrada correspondente em
  // ROUTE_PERMISSIONS. Pega o caso de alguém proteger uma rota nova em
  // index.tsx e esquecer de documentar aqui — a "chave órfã" que o menu (B5)
  // nunca saberia exigir.
  it('nenhuma rota protegida de index.tsx fica de fora do mapa', () => {
    const pathRe = /path="([^"]+)"/g;
    let m: RegExpExecArray | null;
    const foundKeys = new Set<string>();
    // eslint-disable-next-line no-cond-assign
    while ((m = pathRe.exec(src))) {
      const path = m[1];
      const start = m.index;
      const nextRoute = src.indexOf('<Route', start + 1);
      const slice = src.slice(start, nextRoute === -1 ? undefined : nextRoute);
      const permMatch = slice.match(/<PermissionRoute resource="([^"]+)" action="([^"]+)">/);
      if (permMatch) {
        foundKeys.add(`${path}::${permMatch[1]}.${permMatch[2]}`);
      }
    }

    const chatMatch = chatRouteElementBlock().match(/<PermissionRoute resource="([^"]+)" action="([^"]+)">/);
    expect(chatMatch, 'ChatRouteElement sem <PermissionRoute>').not.toBeNull();
    for (const path of SHARED_ELEMENT_PATHS) {
      foundKeys.add(`${path}::${chatMatch![1]}.${chatMatch![2]}`);
    }

    const mapKeys = new Set(ROUTE_PERMISSIONS.map(e => `${e.path}::${e.resource}.${e.action}`));
    const missing = [...foundKeys].filter(k => !mapKeys.has(k));
    expect(
      missing,
      `rota(s) protegida(s) em index.tsx sem entrada em permissionRoutes.ts: ${missing.join(', ') || '(nenhuma)'}`,
    ).toEqual([]);
  });
});
