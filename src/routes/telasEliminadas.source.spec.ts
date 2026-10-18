// Trava das telas eliminadas (17/10/2026): o endereço antigo leva pra tela que
// ficou e a pasta da tela some. Próximas tasks só acrescentam itens nas listas.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve(__dirname, '../..');
const routes = readFileSync(resolve(raiz, 'src/routes/index.tsx'), 'utf8');

// `path` como aparece na <Route> (relativo nas filhas de /automations).
const ENDERECOS: { endereco: string; destino: string }[] = [
  { endereco: 'lead-automations', destino: '/automations' },
  { endereco: '/settings/lead-automations', destino: '/automations' },
  { endereco: 'whatsapp-reminders', destino: '/automations' },
  { endereco: '/settings/whatsapp-reminders', destino: '/automations' },
  { endereco: '/property-interests', destino: '/pipelines' },
  { endereco: '/contacts/scheduled-actions', destino: '/conversations' },
  { endereco: '/marketplace', destino: '/settings/integrations' },
];

const PASTAS_APAGADAS = [
  'src/pages/Customer/Settings/LeadAutomations',
  'src/pages/Customer/Settings/WhatsappReminders',
  'src/pages/Customer/Automations/NoReplyRobot',
  'src/services/whatsappReminders',
  'src/services/noReplyRobot',
  'src/pages/Customer/PropertyInterests',
  'src/pages/Customer/Contacts/ScheduledActions.tsx',
  'src/components/scheduledActions/ScheduledActionsHeader.tsx',
  'src/components/scheduledActions/ScheduledActionsTable.tsx',
  'src/components/scheduledActions/ScheduledActionsList.tsx',
  'src/tours/ScheduledActionsTour.tsx',
  'src/pages/Shared/Marketplace',
  'src/i18n/locales/pt-BR/marketplace.json',
];

// A Área do Admin avisa: o funil de follow-up que ela leva não leva mais a regra de entrada.
const AVISO_ENTRADA = 'A entrada do funil se monta em Automações.';
const TELAS_ADMIN = [
  'src/pages/SuperAdmin/PooledClients/ClientFollowupRolloutModal.tsx',
  'src/pages/SuperAdmin/PooledClients/NewTenantWizard.tsx',
];

describe('telas eliminadas', () => {
  it.each(ENDERECOS)('$endereco leva pra $destino', ({ endereco, destino }) => {
    const re = new RegExp(`<Route\\s+path="${endereco}"\\s+element=\\{\\s*<Navigate to="${destino}" replace />\\s*\\}\\s*/>`);
    expect(routes).toMatch(re);
  });

  it.each(PASTAS_APAGADAS)('%s não existe mais', pasta => {
    expect(existsSync(resolve(raiz, pasta))).toBe(false);
  });

  it.each(TELAS_ADMIN)('%s avisa que a entrada do funil se monta em Automações', arq => {
    const src = readFileSync(resolve(raiz, arq), 'utf8');
    expect(src).toContain(AVISO_ENTRADA);
  });

  it('o namespace marketplace saiu do i18n', () => {
    const cfg = readFileSync(resolve(raiz, 'src/i18n/config.ts'), 'utf8');
    expect(cfg).not.toMatch(/'marketplace'/);
  });
});
