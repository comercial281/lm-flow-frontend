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

// Ruling G3 — mesmo padrão (403 na leitura principal da tela → <NoAccessState>,
// sem toast; outro erro → comportamento de antes) estendido a nove listas que,
// hoje, transformam um 403 em lista vazia. Só a leitura PRINCIPAL é guardada —
// buscas auxiliares (filtros, opções, contadores) continuam como estavam.
// Nenhuma delas ganha esconder botão por cargo aqui (isso é Task B7 para
// Imóveis; fora de escopo para o resto) — só o estado de recusa.
describe('nove listas que viravam vazias na recusa (G3)', () => {
  it('Imóveis: leitura principal recusada mostra o aviso do cargo', () => {
    const src = read('src/pages/Customer/Properties/Properties.tsx');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
  });

  it('Agenda de Visitas: leitura principal recusada mostra o aviso do cargo', () => {
    const src = read('src/pages/Customer/Visits/Visits.tsx');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
  });

  it('Propostas: leitura principal recusada mostra o aviso do cargo', () => {
    const src = read('src/pages/Customer/Proposals/Proposals.tsx');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
  });

  it('Contratos: leitura principal recusada mostra o aviso do cargo', () => {
    const src = read('src/pages/Customer/Contracts/Contracts.tsx');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
  });

  it('Captação: leitura principal recusada mostra o aviso do cargo', () => {
    const src = read('src/pages/Customer/PropertyOwners/NovasCaptacoes.tsx');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
  });

  it('Interesses: leitura principal recusada mostra o aviso do cargo', () => {
    const src = read('src/pages/Customer/PropertyInterests/PropertyInterests.tsx');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
  });

  it('Lembretes WhatsApp: leitura principal recusada mostra o aviso do cargo', () => {
    const src = read('src/pages/Customer/Settings/WhatsappReminders/WhatsappReminders.tsx');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
  });

  // Follow-up (sprint 3): a aba é a lista do construtor com `kind="followup"`.
  it('Follow-up: leitura principal recusada mostra o aviso do cargo', () => {
    const src = read('src/pages/Customer/Automations/FlowBuilder/FlowAutomationsList.tsx');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
  });

  it('Regras de Lead (Automações de Lead): leitura principal recusada mostra o aviso do cargo', () => {
    const src = read('src/pages/Customer/Settings/LeadAutomations/LeadAutomations.tsx');
    expect(src).toContain('isForbiddenError');
    expect(src).toContain('<NoAccessState');
  });
});
