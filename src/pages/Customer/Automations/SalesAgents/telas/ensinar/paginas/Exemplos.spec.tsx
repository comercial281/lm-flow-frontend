import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import type { Licoes } from '../useLicoes';
import Exemplos from './Exemplos';

const L = (id: string, kind: string, extra = {}) => ({ id, kind, content: `resp ${id}`, context: `lead ${id}`, enabled: true, created_at: '2026-10-10T12:00:00Z', origin: 'manual', in_use: true, ...extra });

function abrir(licoes: object[], conversas = [{ lead: 'Tem varanda?', resposta: 'Tem sim!' }], extra: Partial<Licoes> = {}) {
  const l: Licoes = { licoes: licoes as never, limites: { per_kind: 12, conversations: 1 }, estado: 'pronto', carregar: vi.fn(),
    criar: vi.fn().mockResolvedValue(true), atualizar: vi.fn().mockResolvedValue(true), apagar: vi.fn().mockResolvedValue(true), ...extra };
  const gravar = vi.fn().mockResolvedValue(true);
  const confirmar = vi.fn().mockResolvedValue(true);
  render(<MemoryRouter><Exemplos agent={agenteDeTeste({ example_conversations: conversas })} gravar={gravar} licoes={l} arquivos={{} as never} irPara={vi.fn()} confirmar={confirmar} /></MemoryRouter>);
  return { l, gravar, confirmar };
}

describe('Exemplos', () => {
  it('Responda assim junta lições boas e conversas reais', () => {
    abrir([L('a', 'good_example'), L('b', 'bad_example')]);
    expect(screen.getByText('resp a')).toBeInTheDocument();
    expect(screen.getByText('Tem sim!')).toBeInTheDocument();
    expect(screen.getByText('Conversa real')).toBeInTheDocument();
    expect(screen.queryByText('resp b')).not.toBeInTheDocument();
    expect(screen.getByText('Ela imita o ritmo e o tom, não copia palavra por palavra.')).toBeInTheDocument();
  });

  it('conversa real além do limite não vale', () => {
    abrir([], [{ lead: 'x', resposta: 'primeira' }, { lead: 'y', resposta: 'segunda' }]);
    expect(screen.getAllByText('Não está valendo')).toHaveLength(1);
  });

  it('lição pausada não ganha selo de não valendo', () => {
    abrir([L('a', 'good_example', { enabled: false, in_use: false }), L('b', 'good_example', { in_use: false })], []);
    expect(screen.getAllByText('Não está valendo')).toHaveLength(1);
  });

  it('novo exemplo na aba ruim cria bad_example', async () => {
    const { l } = abrir([]);
    await userEvent.click(screen.getByRole('tab', { name: /Não responda assim/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Novo exemplo' }));
    await userEvent.type(screen.getByLabelText('O que o lead disse'), 'Qual o valor?');
    await userEvent.type(screen.getByLabelText('A resposta que ela não deve dar'), 'R$ 389 mil.');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar exemplo' }));
    expect(l.criar).toHaveBeenCalledWith('bad_example', 'R$ 389 mil.', 'Qual o valor?');
  });

  it('Salvar exemplo fica desabilitado sem resposta', async () => {
    abrir([]);
    await userEvent.click(screen.getByRole('button', { name: 'Novo exemplo' }));
    expect(screen.getByRole('button', { name: 'Salvar exemplo' })).toBeDisabled();
  });

  it('editar lição salva content e context', async () => {
    const { l } = abrir([L('a', 'good_example')], []);
    await userEvent.click(screen.getByRole('button', { name: /Ações do exemplo/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const resp = screen.getByLabelText('Como ela deve responder');
    await userEvent.clear(resp);
    await userEvent.type(resp, 'nova');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar exemplo' }));
    expect(l.atualizar).toHaveBeenCalledWith('a', { content: 'nova', context: 'lead a' });
  });

  it('editar conversa real grava a lista com o item trocado', async () => {
    const { gravar } = abrir([], [{ lead: 'x', resposta: 'primeira' }, { lead: 'y', resposta: 'segunda' }]);
    await userEvent.click(screen.getAllByRole('button', { name: /Ações do exemplo/ })[1]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const resp = screen.getByLabelText('Como ela deve responder');
    await userEvent.clear(resp);
    await userEvent.type(resp, 'trocada');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar exemplo' }));
    expect(gravar).toHaveBeenCalledWith({ example_conversations: [{ lead: 'x', resposta: 'primeira' }, { lead: 'y', resposta: 'trocada' }] });
  });

  it('mover lição boa pra ruim', async () => {
    const { l } = abrir([L('a', 'good_example')], []);
    await userEvent.click(screen.getByRole('button', { name: /Ações do exemplo/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover pra Não responda assim' }));
    expect(l.atualizar).toHaveBeenCalledWith('a', { kind: 'bad_example' });
  });

  it('conversa real não tem Mover', async () => {
    abrir([], [{ lead: 'x', resposta: 'primeira' }]);
    await userEvent.click(screen.getByRole('button', { name: /Ações do exemplo/ }));
    expect(screen.queryByRole('menuitem', { name: /Mover/ })).not.toBeInTheDocument();
  });

  it('apagar conversa real confirma e grava a lista sem ela', async () => {
    const { gravar, confirmar } = abrir([], [{ lead: 'x', resposta: 'primeira' }, { lead: 'y', resposta: 'segunda' }]);
    await userEvent.click(screen.getAllByRole('button', { name: /Ações do exemplo/ })[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Apagar' }));
    expect(confirmar).toHaveBeenCalled();
    expect(gravar).toHaveBeenCalledWith({ example_conversations: [{ lead: 'y', resposta: 'segunda' }] });
  });

  it('apagar lição confirma e apaga; sem confirmação não apaga', async () => {
    const { l, confirmar } = abrir([L('a', 'good_example')], []);
    confirmar.mockResolvedValueOnce(false);
    await userEvent.click(screen.getByRole('button', { name: /Ações do exemplo/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Apagar' }));
    expect(l.apagar).not.toHaveBeenCalled();
  });

  it('vazio da aba ruim', async () => {
    abrir([], []);
    expect(screen.getByText('Nenhum exemplo de como responder')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Não responda assim/ }));
    expect(screen.getByText('Nenhum exemplo do que evitar')).toBeInTheDocument();
    expect(screen.getByText('Respostas que ela deve evitar.')).toBeInTheDocument();
  });
});
