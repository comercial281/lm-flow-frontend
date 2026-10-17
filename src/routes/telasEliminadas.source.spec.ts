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
];

const PASTAS_APAGADAS = [
  'src/pages/Customer/Settings/LeadAutomations',
  'src/pages/Customer/Settings/WhatsappReminders',
  'src/pages/Customer/Automations/NoReplyRobot',
  'src/services/whatsappReminders',
  'src/services/noReplyRobot',
];

describe('telas eliminadas', () => {
  it.each(ENDERECOS)('$endereco leva pra $destino', ({ endereco, destino }) => {
    const re = new RegExp(`<Route\\s+path="${endereco}"\\s+element=\\{\\s*<Navigate to="${destino}" replace />\\s*\\}\\s*/>`);
    expect(routes).toMatch(re);
  });

  it.each(PASTAS_APAGADAS)('%s não existe mais', pasta => {
    expect(existsSync(resolve(raiz, pasta))).toBe(false);
  });
});
