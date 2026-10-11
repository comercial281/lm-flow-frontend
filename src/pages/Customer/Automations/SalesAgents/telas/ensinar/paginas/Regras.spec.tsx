import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import type { Licoes } from '../useLicoes';
import Regras from './Regras';

const L = (id: string, extra = {}) => ({ id, kind: 'rule', content: `regra ${id}`, context: null, enabled: true, created_at: '2026-10-10T12:00:00Z', origin: 'manual', in_use: true, ...extra });

function abrir(licoes: object[], extra: Partial<Licoes> = {}) {
  const l: Licoes = { licoes: licoes as never, limites: { per_kind: 12, conversations: 6 }, estado: 'pronto', carregar: vi.fn(),
    criar: vi.fn().mockResolvedValue(true), atualizar: vi.fn().mockResolvedValue(true), apagar: vi.fn().mockResolvedValue(true), ...extra };
  const confirmar = vi.fn().mockResolvedValue(true);
  render(<MemoryRouter><Regras agent={agenteDeTeste()} gravar={vi.fn()} licoes={l} arquivos={{} as never} irPara={vi.fn()} confirmar={confirmar} /></MemoryRouter>);
  return { l, confirmar };
}

describe('Regras', () => {
  it('medidor conta as que valem e o aviso aparece com regra fora', () => {
    abrir([L('a'), L('b', { in_use: false }), L('c', { enabled: false, in_use: false })]);
    expect(screen.getByText(/1 de 12/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 regra não está valendo.');
    expect(screen.getByText('Não está valendo')).toBeInTheDocument();
    expect(screen.getByText('Pausada')).toBeInTheDocument();
  });

  it('origem: Escrita à mão ou Sugestão aceita', () => {
    abrir([L('a'), L('c', { origin: 'suggestion' })]);
    expect(screen.getByText('Escrita à mão')).toBeInTheDocument();
    expect(screen.getByText('Sugestão aceita')).toBeInTheDocument();
  });

  it('adicionar cria regra e trava o botão enquanto grava (clique duplo)', async () => {
    let soltar!: (v: boolean) => void;
    const criar = vi.fn(() => new Promise<boolean>((r) => { soltar = r; }));
    abrir([], { criar });
    await userEvent.type(screen.getByLabelText('Nova regra'), 'Não prometa aprovação');
    const botao = screen.getByRole('button', { name: 'Adicionar' });
    await userEvent.click(botao);
    await userEvent.click(botao);
    expect(criar).toHaveBeenCalledTimes(1);
    expect(criar).toHaveBeenCalledWith('rule', 'Não prometa aprovação');
    await act(async () => { soltar(true); });
  });

  it('a chave pausa', async () => {
    const { l } = abrir([L('a')]);
    await userEvent.click(screen.getByRole('switch', { name: /regra a/ }));
    expect(l.atualizar).toHaveBeenCalledWith('a', { enabled: false });
  });

  it('filtro Pausadas mostra só as pausadas', async () => {
    abrir([L('a'), L('b', { enabled: false })]);
    await userEvent.click(screen.getByRole('tab', { name: /Pausadas/ }));
    expect(screen.queryByText('regra a')).not.toBeInTheDocument();
    expect(screen.getByText('regra b')).toBeInTheDocument();
  });

  it('filtro Escritas à mão deixa de fora as sugestões aceitas', async () => {
    abrir([L('a'), L('b', { origin: 'suggestion' })]);
    await userEvent.click(screen.getByRole('tab', { name: /Escritas à mão/ }));
    expect(screen.getByText('regra a')).toBeInTheDocument();
    expect(screen.queryByText('regra b')).not.toBeInTheDocument();
  });

  it('excluir pede confirmação', async () => {
    const { l, confirmar } = abrir([L('a')]);
    await userEvent.click(screen.getByRole('button', { name: 'Ações da regra regra a' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Excluir regra', rotuloDaAcao: 'Excluir' }));
    expect(l.apagar).toHaveBeenCalledWith('a');
  });

  it('vazio explica de onde vêm as regras', () => {
    abrir([]);
    expect(screen.getByText('Nenhuma regra ainda')).toBeInTheDocument();
  });

  it('erro de carga não vira lista vazia', async () => {
    const { l } = abrir([], { estado: 'erro' });
    expect(screen.queryByText('Nenhuma regra ainda')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(l.carregar).toHaveBeenCalled();
  });

  it('nova regra e edição param no teto do servidor (4000 letras)', async () => {
    abrir([L('a')]);
    expect(screen.getByLabelText('Nova regra')).toHaveAttribute('maxLength', '4000');
    await userEvent.click(screen.getByRole('button', { name: 'Ações da regra regra a' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(screen.getByLabelText('Editar regra')).toHaveAttribute('maxLength', '4000');
  });
});
