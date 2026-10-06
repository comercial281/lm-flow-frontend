import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.fn();
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, update: (...a: unknown[]) => update(...a) } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(async (_id: string, patch: Partial<SalesAgent>) => agenteDeTeste(patch));
});

const salvar = () => userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

vi.mock('@/store/appDataStore', () => ({
  useAppDataStore: (sel: (s: { account: { name: string } }) => unknown) => sel({ account: { name: 'Aurora Imóveis' } }),
}));

import Passo1QuemEla from './Passo1QuemEla';

const abrir = (agent: SalesAgent = agenteDeTeste()) =>
  render(<MemoryRouter><Passo1QuemEla agent={agent} inboxes={[]} aoSalvo={vi.fn()} irParaPasso={vi.fn()} /></MemoryRouter>);

describe('Passo 1 · Quem ela é', () => {
  it('IA antiga em primeira pessoa abre como o próprio corretor', () => {
    abrir();
    expect(screen.getByLabelText('O próprio corretor')).toBeChecked();
  });

  // Corretor fixo escolhido (caso Pinot & Cheer) continua: trocar a persona não apaga
  // calado o corretor que alguém escolheu. Só o "dono do número" volta pra roleta.
  it('trocar pra dono da imobiliária e dar o nome: a voz sai e o corretor fixo fica', async () => {
    abrir();
    await userEvent.click(screen.getByLabelText('Dono da imobiliária'));
    await userEvent.type(screen.getByLabelText('Nome que o lead vê'), 'Tony');
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', {
      persona_kind: 'owner',
      lead_facing_name: 'Tony',
      transfer_config: { mode: 'checklist', required_questions: ['Renda'] },
    });
  });

  it('saindo do corretor que entregava pro dono do número: o destino volta pra roleta do número', async () => {
    abrir(agenteDeTeste({ handoff_target: 'number_owner', handoff_user_id: null, lead_facing_name: 'Bruno' }));
    await userEvent.click(screen.getByLabelText('Dono da imobiliária'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', {
      persona_kind: 'owner',
      transfer_config: { mode: 'checklist', required_questions: ['Renda'] },
      handoff_target: 'inbox_roleta',
    });
  });

  // Obrigatório pra LIGAR (passo 8), não pra salvar o resto do passo.
  it('sem o nome que o lead vê, avisa e ainda salva o resto', async () => {
    abrir();
    expect(screen.getByText('Sem ele, a IA não liga.')).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Curtir mensagens do lead'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { reaction_enabled: true });
  });

  it('a prévia muda com a persona, com o nome e a imobiliária da conta', async () => {
    abrir(agenteDeTeste({ lead_facing_name: 'Bruno' }));
    expect(screen.getByText(/^Oi! Aqui quem fala é Bruno, da Aurora Imóveis/)).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Assistente da imobiliária'));
    expect(screen.getByText(/^Oi! Eu sou Bruno, assistente virtual da Aurora Imóveis/)).toBeTruthy();
  });

  // Tom e emoji: sem controle até a entrega 4 (o v1 tem "não use emoji" fixo).
  it('não mostra tom nem emoji', () => {
    abrir();
    expect(screen.queryByLabelText('Profissional')).toBeNull();
    expect(screen.queryByLabelText('Sem emoji')).toBeNull();
  });

  it('corretor num número sem dono: avisa', () => {
    abrir(agenteDeTeste({ number_owner_id: null }));
    expect(screen.getByText(/não tem corretor dono/)).toBeTruthy();
  });

  it('curtidas: só os emojis marcados viajam', async () => {
    abrir(agenteDeTeste({ lead_facing_name: 'Bruno' }));
    await userEvent.click(screen.getByLabelText('Curtir mensagens do lead'));
    await userEvent.click(screen.getByRole('button', { name: 'Usar 🔥' }));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { reaction_enabled: true, reaction_emojis: ['👍', '🔥'] });
  });
});
