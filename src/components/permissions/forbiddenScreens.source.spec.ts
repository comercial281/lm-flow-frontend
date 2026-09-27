import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// IA Vendedora (5.000+ linhas) e Disparos puxam meia aplicação para montar.
// O que importa é a regra, que mora em forbidden.ts (com spec própria); aqui só
// se confere que as duas telas a usam e perderam o "vazio" na recusa.
const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf8');

describe('as listas que mais doíam não viram tela vazia na recusa', () => {
  it('IA Vendedora: recusa vira aviso, não "Nenhuma IA criada"', () => {
    const src = read('src/pages/Customer/Automations/SalesAgents/SalesAgents.tsx');
    expect(src).toContain('classifyLoadFailure');
    expect(src).toContain("loadFailure === 'forbidden'");
    expect(src).toContain('<NoAccessState');
    expect(src).toContain("pode('sales_agents', 'create')");
  });

  it('Disparos: lista recusada não vira lista vazia', () => {
    const src = read('src/pages/Customer/Disparos/Disparos.tsx');
    expect(src).not.toContain('broadcastsService.list(pid).then(setCampaigns).catch(() => setCampaigns([]))');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
    expect(src).toContain("pode('broadcasts', 'create')");
  });
});
