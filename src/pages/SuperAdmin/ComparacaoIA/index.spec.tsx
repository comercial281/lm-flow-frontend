import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listAll = vi.hoisted(() => vi.fn());
const comparisonCandidates = vi.hoisted(() => vi.fn());
const comparisonEvaluate = vi.hoisted(() => vi.fn());
vi.mock('@/services/superAdmin/superAgentsService', () => ({
  superAgentsService: { listAll, comparisonCandidates, comparisonEvaluate },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ComparacaoIA from './index';

const notas = { obrigatorias: null, repasse: null, persona: 2, configuracao: 2, puxou_conversa: 2, seguranca: 2 };
function lado(texto: string, extra = {}) {
  return { version: 1, comment: null, scores: { ...notas, ...extra },
    turn: { kind: 'reply', at: '', messages: [{ content: texto, pause_ms: 0 }], reaction: null, note: null, media: [], outcome: null } };
}

beforeEach(() => {
  [listAll, comparisonCandidates, comparisonEvaluate].forEach((f) => f.mockReset());
  listAll.mockResolvedValue([{ id: 'a1', tenant_slug: 'dezesseis', tenant_name: 'Imobiliária Exemplo', name: 'IA Exemplo' }]);
  comparisonCandidates.mockResolvedValue([{ id: 'c1', contact_name: 'Camila', last_reply_at: '2026-10-04T10:00:00-03:00', points: 2, in_handoff: false, has_visit: false }]);
});

describe('ComparacaoIA', () => {
  it('compara ponto a ponto na mesma rodada e filtra onde discordam', async () => {
    const user = userEvent.setup();
    comparisonEvaluate
      .mockResolvedValueOnce({ conversation_id: 'c1', point_index: 0, history_tail: 'Lead: oi', real_reply: 'Oi!', baseline: lado('Pra morar?'), candidate: lado('Morar ou investir?'), judge_model: 'm', disagreement: false })
      .mockResolvedValueOnce({ conversation_id: 'c1', point_index: 1, history_tail: 'Lead: sim', real_reply: 'Qual região?', baseline: lado('Qual região?'), candidate: lado('Ok.', { puxou_conversa: 0 }), judge_model: 'm', disagreement: true });

    render(<ComparacaoIA />);
    await user.selectOptions(await screen.findByLabelText('IA'), 'a1');
    await user.click(screen.getByRole('button', { name: 'Buscar conversas' }));
    await screen.findByText(/Camila/);
    await user.click(screen.getByLabelText('Incluir os cenários do Testar'));
    await user.click(screen.getByRole('button', { name: 'Comparar' }));

    await screen.findByText('Ok.');
    expect(comparisonEvaluate).toHaveBeenCalledTimes(2);
    const [r1, r2] = comparisonEvaluate.mock.calls.map((c) => c[2]);
    expect(r1.run_id).toBe(r2.run_id);
    expect(r1).toMatchObject({ conversation_id: 'c1', point_index: 0, baseline_version: 1, candidate_version: 1 });
    expect(screen.getByText('O novo perde em: Terminou puxando a conversa.')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Só onde discordam'));
    await waitFor(() => expect(screen.queryByText('Morar ou investir?')).not.toBeInTheDocument());
    expect(screen.getByText('Ok.')).toBeInTheDocument();
  });
  it('durante a rodada os três seletores ficam travados', async () => {
    const user = userEvent.setup();
    let liberar: (v: unknown) => void = () => {};
    comparisonEvaluate.mockReturnValue(new Promise((r) => { liberar = r; }));
    render(<ComparacaoIA />);
    await user.selectOptions(await screen.findByLabelText('IA'), 'a1');
    await user.click(screen.getByRole('button', { name: 'Buscar conversas' }));
    await screen.findByText(/Camila/);
    await user.click(screen.getByLabelText('Incluir os cenários do Testar'));
    await user.click(screen.getByRole('button', { name: 'Comparar' }));
    for (const nome of ['IA', 'Roteiro antigo', 'Roteiro novo']) expect(await screen.findByLabelText(nome)).toBeDisabled();
    liberar({ conversation_id: 'c1', point_index: 0, history_tail: '', real_reply: null, baseline: lado('a'), candidate: lado('b'), judge_model: 'm', disagreement: false });
    await waitFor(() => expect(screen.getByLabelText('IA')).toBeEnabled());
  });

  it('erro ao listar as IAs aparece como erro e tenta de novo', async () => {
    listAll.mockReset();
    listAll.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([{ id: 'a1', tenant_slug: 'dezesseis', tenant_name: 'Imobiliária Exemplo', name: 'IA Exemplo' }]);
    const user = userEvent.setup();
    render(<ComparacaoIA />);
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('IA')).toBeInTheDocument();
  });

  it('busca sem conversa mostra vazio; erro na busca mostra erro com o motivo', async () => {
    const user = userEvent.setup();
    comparisonCandidates.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('A IA não tem roteiro 2.'));
    render(<ComparacaoIA />);
    await user.selectOptions(await screen.findByLabelText('IA'), 'a1');
    await user.click(screen.getByRole('button', { name: 'Buscar conversas' }));
    expect(await screen.findByText('Nenhuma conversa com resposta da IA para comparar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Buscar conversas' }));
    expect(await screen.findByText('A IA não tem roteiro 2.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });
});
