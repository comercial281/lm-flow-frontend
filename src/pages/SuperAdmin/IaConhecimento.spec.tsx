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

  it('ensinar uma lição global confirma e só grava no ok', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { id: 'l1', kind: 'rule', content: 'Sempre proponha a visita.' } } });
    const user = userEvent.setup();
    render(<IaConhecimento />);
    await user.type(await screen.findByLabelText('A regra que ela deve seguir'), 'Sempre proponha a visita.');
    await user.click(screen.getByRole('button', { name: 'Ensinar' }));
    expect(await screen.findByText('Esta lição passa a valer para todas as IAs de todos os clientes.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ensinar' }));
    await user.click(await screen.findByRole('button', { name: 'Ensinar para todos' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/super/global_sales_lessons', expect.objectContaining({ content: 'Sempre proponha a visita.' })));
  });

  it('adicionar texto e subir arquivo na base confirmam; cancelar não grava', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { id: 'd1' } } });
    const user = userEvent.setup();
    render(<IaConhecimento />);
    await user.type(await screen.findByLabelText('Título'), 'Argumentário');
    await user.type(screen.getByLabelText('Conteúdo (cole o texto)'), 'Valorização de 10% ao ano.');
    await user.click(screen.getByRole('button', { name: 'Adicionar texto' }));
    expect(await screen.findByText(/Vale para as IAs de todos os clientes\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Adicionar texto' }));
    await user.click(await screen.findByRole('button', { name: 'Adicionar para todos' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));

    api.post.mockClear();
    const arquivo = new File(['oi'], 'regras.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText('Arquivo para a base de conhecimento'), arquivo);
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(api.post).not.toHaveBeenCalled();
    await user.upload(screen.getByLabelText('Arquivo para a base de conhecimento'), arquivo);
    await user.click(await screen.findByRole('button', { name: 'Subir para todos' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  });

  it('desligar documento global confirma; ligar não', async () => {
    const doc = (enabled: boolean) => ({ id: 'd1', title: 'Argumentário', category: null, enabled, status: 'ready', char_count: 10, content_text: 'x', has_file: false });
    responder({ '/super/global_knowledge_documents': () => Promise.resolve({ data: { success: true, data: [doc(true)] } }) });
    api.put.mockResolvedValue({ data: { success: true, data: doc(false) } });
    const user = userEvent.setup();
    render(<IaConhecimento />);
    await user.click(await screen.findByRole('switch', { name: 'Usar Argumentário nas IAs' }));
    expect(await screen.findByText(/deixa de valer para as IAs de todos os clientes/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Usar Argumentário nas IAs' })).toBeChecked();

    await user.click(screen.getByRole('switch', { name: 'Usar Argumentário nas IAs' }));
    await user.click(await screen.findByRole('button', { name: 'Desligar' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    // ligar de volta: grava direto, sem pergunta
    await user.click(await screen.findByRole('switch', { name: 'Usar Argumentário nas IAs' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Desligar' })).not.toBeInTheDocument();
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
