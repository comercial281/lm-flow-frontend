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

import Passo3Roteiro from './Passo3Roteiro';

const abrir = (agent: SalesAgent, irParaPasso = vi.fn()) => {
  render(<MemoryRouter><Passo3Roteiro agent={agent} inboxes={[]} aoSalvo={vi.fn()} irParaPasso={irParaPasso} /></MemoryRouter>);
  return irParaPasso;
};
const dono = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({
  persona_kind: 'owner', handoff_target: 'inbox_roleta', handoff_user_id: null,
  transfer_config: { mode: 'checklist', required_questions: ['Renda'], briefing_enabled: false }, ...extra,
});

describe('Passo 3 · Roteiro', () => {
  it('nova pergunta obrigatória: grava a lista e as marcadas, preservando o resto do repasse', async () => {
    abrir(dono());
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar pergunta' }));
    await userEvent.type(screen.getByLabelText('Pergunta 3'), 'Usa FGTS?');
    await userEvent.click(screen.getByLabelText('Pergunta 3 é obrigatória'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', {
      qualification_questions: ['Renda', 'Quartos', 'Usa FGTS?'],
      transfer_config: { mode: 'checklist', required_questions: ['Renda', 'Usa FGTS?'], briefing_enabled: false },
    });
  });

  it('não deixa desmarcar a última obrigatória', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Pergunta 1 é obrigatória'));
    expect(screen.getByLabelText('Pergunta 1 é obrigatória')).toBeChecked();
    expect(screen.getByText(/Pelo menos uma pergunta precisa ser obrigatória/)).toBeTruthy();
  });

  it('subir uma pergunta muda a ordem', async () => {
    abrir(dono());
    await userEvent.click(screen.getByRole('button', { name: 'Subir pergunta 2' }));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', expect.objectContaining({ qualification_questions: ['Quartos', 'Renda'] }));
  });

  it('avisa das perguntas do roteiro de hoje e do cenário que não segura', async () => {
    const ir = abrir(dono({ transfer_config: { mode: 'temperatura' } }));
    expect(screen.getByText(/também tem 1 pergunta no roteiro de hoje/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Objetivo' }));
    expect(ir).toHaveBeenCalledWith(2);
  });

  it('o que ela não faz preserva os outros limites', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Negociar desconto'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { ai_limits: { address: true, discount: true } });
  });

  it('primeira mensagem com texto meu de base', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Com um texto meu de base'));
    await userEvent.type(screen.getByLabelText('Texto de base'), 'Oi! Vi que você gostou do Alma.');
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', { greeting: 'Oi! Vi que você gostou do Alma.' });
  });

  // Queixa do dono do produto: "ela sempre pergunta se é pra morar ou investir".
  // O controle fica à vista do gestor, sem a chave do roteiro (ia_playbook).
  it('"Perguntar se é pra morar ou investir" vai pro roteiro sem apagar os encaixes', async () => {
    abrir(dono());
    expect(screen.getByRole('heading', { name: 'Perguntar se é pra morar ou investir' })).toBeTruthy();
    expect(screen.getByText(/mesmo depois da primeira mensagem da automação/)).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Só se a IA abrir a conversa'));
    await salvar();
    expect(update).toHaveBeenCalledWith('ia-1', {
      playbook: { vars: { perguntas_situacao: ['Mora de aluguel?'] }, intent_question_mode: 'opening_only' },
    });
  });

  it('"Não, ela deduz pela conversa" esconde o texto da pergunta', async () => {
    abrir(dono());
    await userEvent.click(screen.getByLabelText('Não, ela deduz pela conversa'));
    expect(screen.queryByLabelText('Texto da pergunta')).toBeNull();
  });

  it('a primeira mensagem diz quando vale', () => {
    abrir(dono());
    expect(screen.getByText('Vale quando o lead escreve primeiro. Lead de formulário recebe a mensagem da automação.')).toBeTruthy();
  });
});
