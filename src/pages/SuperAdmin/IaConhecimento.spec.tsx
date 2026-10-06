import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import IaConhecimento from './IaConhecimento';

const bloco = { key: 'tom', label: 'Tom de voz', content: 'Fale curto.', factory_default: 'Fale curto.', customized: false,
  enabled: true, updated_at: null, allowed_markers: [], kind: 'principle' };
const propostas = [
  { id: 'g1', source: 'refine', scope: 'global', kind: 'rule', content: 'Nunca prometa desconto.', status: 'pending', created_at: '' },
  { id: 'i1', source: 'curation', scope: 'individual', kind: 'rule', content: 'Use o nome do lead.', status: 'pending', agent_name: 'Sara', created_at: '' },
];

type Resposta = () => Promise<unknown>;
function responder(trocas: Record<string, Resposta> = {}) {
  const mapa: Record<string, Resposta> = {
    '/super/global_knowledge_documents': () => Promise.resolve({ data: { success: true, data: [] } }),
    '/super/global_sales_lessons': () => Promise.resolve({ data: { success: true, data: [] } }),
    '/super/ai_playbook_blocks': () => Promise.resolve({ data: { data: [bloco] } }),
    '/super/sdr_proposals': () => Promise.resolve({ data: { success: true, data: propostas } }),
    '/super/sales_agents': () => Promise.resolve({ data: { success: true, data: [] } }),
    ...trocas,
  };
  api.get.mockImplementation((url: string) => (mapa[url] ?? (() => Promise.reject(new Error(url))))());
}

describe('IA Vendedora → Conhecimento', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); responder(); });

  it('quatro seções com o quadro padrão e nenhuma aba feita à mão', async () => {
    render(<IaConhecimento />);
    for (const nome of ['Base de conhecimento', 'Escola de vendas', 'Princípios', 'Aperfeiçoamento']) {
      expect(await screen.findByRole('region', { name: nome })).toBeInTheDocument();
    }
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('salvar um Princípio confirma que vale para todos e só grava no ok', async () => {
    api.patch.mockResolvedValue({ data: { data: { ...bloco, content: 'Fale curtíssimo.', customized: true } } });
    const user = userEvent.setup();
    render(<IaConhecimento />);
    const campo = await screen.findByLabelText('Tom de voz');
    await user.clear(campo);
    await user.type(campo, 'Fale curtíssimo.');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Vale para as IAs de todos os clientes.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.patch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await user.click(await screen.findByRole('button', { name: 'Salvar para todos' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/super/ai_playbook_blocks/tom', { content: 'Fale curtíssimo.' }));
  });

  it('aprovar lição global confirma; lição de um cliente aprova direto', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: {} } });
    const user = userEvent.setup();
    render(<IaConhecimento />);
    await screen.findByText('Nunca prometa desconto.');
    const [, aprovarIndividual] = screen.getAllByRole('button', { name: 'Aprovar' });
    await user.click(aprovarIndividual);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/sdr_proposals/i1/approve'));
    expect(screen.queryByText('Esta lição passa a valer para todas as IAs de todos os clientes.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(await screen.findByText('Esta lição passa a valer para todas as IAs de todos os clientes.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aprovar para todos' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/sdr_proposals/g1/approve'));
  });

  it('erro numa seção aparece como erro com tentar de novo; as outras seguem', async () => {
    let falhar = true;
    responder({
      '/super/sdr_proposals': () => (falhar ? Promise.reject(new Error('boom')) : Promise.resolve({ data: { success: true, data: propostas } })),
    });
    const user = userEvent.setup();
    render(<IaConhecimento />);
    const aperfeicoamento = await screen.findByRole('region', { name: 'Aperfeiçoamento' });
    const tentar = await within(aperfeicoamento).findByRole('button', { name: 'Tentar de novo' });
    expect(within(aperfeicoamento).queryByText('Nenhuma proposta pendente')).not.toBeInTheDocument();
    expect(await screen.findByText('Nada na base ainda')).toBeInTheDocument();
    falhar = false;
    await user.click(tentar);
    expect(await within(aperfeicoamento).findByText('Nunca prometa desconto.')).toBeInTheDocument();
  });
});
