import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// As rotas moram num arquivo de 1.300 linhas; montar o roteador inteiro num
// teste puxaria todas as telas. Lê o código-fonte, como o spec do convite.
const src = readFileSync(resolve(__dirname, 'index.tsx'), 'utf8');
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
    ['/settings/follow-ups', 'followup_sequences', 'read'],
    ['follow-ups', 'followup_sequences', 'read'],
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

  it('Espaço continua sem cargo, por decisão registrada (o servidor não confere)', () => {
    expect(trecho('/espaco')).not.toContain('PermissionRoute');
  });
});
