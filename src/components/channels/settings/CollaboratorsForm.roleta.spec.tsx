import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';

// Canais × roleta nova (06/10/2026). D6: a roleta não tem número, e a
// "Atribuição Automática" do canal era um segundo motor decidindo quem recebe o
// lead — ela saiu. D8: o horário é da roleta, e a aba "Horário de
// funcionamento" do canal saiu.
const t = vi.hoisted(() => (key: string) => key);
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t }) }));
const getAll = vi.hoisted(() => vi.fn());
const getMembers = vi.hoisted(() => vi.fn());
vi.mock('@/services/channels/agentsService', () => ({ default: { getAll } }));
vi.mock('@/services/channels/inboxMembersService', () => ({ default: { get: getMembers, update: vi.fn() } }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useClientToggle: () => false }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CollaboratorsForm from './CollaboratorsForm';

beforeEach(() => {
  getAll.mockReset().mockResolvedValue([{ id: 'u-ana', name: 'Ana', email: 'ana@imob.test', role: 'agent' }]);
  getMembers.mockReset().mockResolvedValue([]);
});

describe('Canais · Colaboradores × roleta nova', () => {
  it('a Atribuição Automática não aparece', async () => {
    render(<CollaboratorsForm inboxId="inbox-1" />);
    await screen.findByRole('heading', { name: 'Ana' });
    expect(screen.queryByText('settings.collaborators.autoAssignment.title')).toBeNull();
    expect(screen.queryByText('Atribuição Automática')).toBeNull();
  });
});

describe('Canais · aba Horário de funcionamento', () => {
  // A tela inteira do canal depende de uma dúzia de serviços; o que importa aqui
  // é que a aba e o formulário não voltem pra lista de abas.
  it('não está mais na lista de abas do canal (todos os clientes)', () => {
    const fonte = readFileSync(resolve(__dirname, '../../../pages/Customer/Channels/ChannelSettings.tsx'), 'utf8');
    expect(fonte).not.toMatch(/key: 'businesshours'/);
    expect(fonte).not.toMatch(/<BusinessHoursForm/);
  });
});
