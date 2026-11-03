import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import type { Licoes as LicoesDaIa } from '../useLicoes';
import Licoes from './Licoes';

const L = (id: string, extra = {}) => ({
  id, kind: 'rule', content: `ela faz ${id}`, context: `quando ${id}`, enabled: true, created_at: '2026-10-10T12:00:00Z',
  origin: 'equipe', topic: null, bad_content: null, why: null, in_use: true, ...extra,
});
const contador = (extra = {}) => ({ valendo: 0, pausadas: 0, fora_por_tamanho: 0, cabem: 40, ...extra });

function abrir(licoes: object[], extra: Partial<LicoesDaIa> = {}) {
  const l: LicoesDaIa = {
    licoes: licoes as never, limites: { per_kind: 40, conversations: 6 }, estado: 'pronto',
    contadores: { regras: contador({ valendo: licoes.length }), exemplos: contador({ cabem: 20 }) },
    carregar: vi.fn(), criar: vi.fn().mockResolvedValue(true), atualizar: vi.fn().mockResolvedValue(true), apagar: vi.fn().mockResolvedValue(true), ...extra,
  };
  const confirmar = vi.fn().mockResolvedValue(true);
  render(<MemoryRouter><Licoes agent={agenteDeTeste()} gravar={vi.fn()} licoes={l} arquivos={{} as never} irPara={vi.fn()} confirmar={confirmar} /></MemoryRouter>);
  return { l, confirmar };
}

describe('Lições', () => {
  it('cartão "Quando" / "Ela" com chave, tema e origem', () => {
    abrir([L('a', { topic: 'preco', origin: 'correcao' })]);
    const cartao = within(screen.getByRole('listitem'));
    expect(cartao.getByText('Quando')).toBeInTheDocument();
    expect(cartao.getByText('quando a')).toBeInTheDocument();
    expect(cartao.getByText('Ela')).toBeInTheDocument();
    expect(cartao.getByText('ela faz a')).toBeInTheDocument();
    expect(cartao.getByRole('switch', { name: /ela faz a/ })).toBeChecked();
    expect(cartao.getByText('Preço')).toBeInTheDocument();
    expect(cartao.getByText('Correção de conversa')).toBeInTheDocument();
  });

  it('cada origem tem o selo dela (correção não vira "escrita à mão")', () => {
    abrir([L('a'), L('b', { origin: 'sugestao' }), L('c', { origin: 'correcao' })]);
    const [a, b, c] = screen.getAllByRole('listitem');
    expect(within(a).getByText('Escrita pela equipe')).toBeInTheDocument();
    expect(within(b).getByText('Sugestão')).toBeInTheDocument();
    expect(within(c).getByText('Correção de conversa')).toBeInTheDocument();
    expect(screen.queryByText('Escrita à mão')).not.toBeInTheDocument();
  });

  it('o contador vem do servidor: 41 regras, 40 valendo e 1 fora por tamanho', () => {
    abrir([L('a')], { contadores: { regras: contador({ valendo: 40, fora_por_tamanho: 1 }), exemplos: contador({ cabem: 20 }) } });
    expect(screen.getByText('40 valendo de 41 · cabem até 40')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 fora por tamanho');
  });

  it('pausadas entram no "de M" e aparecem no contador', () => {
    abrir([L('a')], { contadores: { regras: contador({ valendo: 3, pausadas: 2 }), exemplos: contador({ cabem: 20 }) } });
    expect(screen.getByText('3 valendo de 5 · cabem até 40')).toBeInTheDocument();
    expect(screen.getByText('2 pausadas')).toBeInTheDocument();
  });

  it('filtro por tema', async () => {
    abrir([L('a', { topic: 'preco' }), L('b', { topic: 'tom' }), L('c')]);
    await userEvent.click(screen.getByRole('tab', { name: /Preço/ }));
    expect(screen.getByText('ela faz a')).toBeInTheDocument();
    expect(screen.queryByText('ela faz b')).not.toBeInTheDocument();
    expect(screen.queryByText('ela faz c')).not.toBeInTheDocument();
  });

  it('filtro por origem trata as três', async () => {
    abrir([L('a'), L('b', { origin: 'sugestao' }), L('c', { origin: 'correcao' })]);
    const origem = screen.getByLabelText('Origem');
    await userEvent.selectOptions(origem, 'correcao');
    expect(screen.getByText('ela faz c')).toBeInTheDocument();
    expect(screen.queryByText('ela faz a')).not.toBeInTheDocument();
    await userEvent.selectOptions(origem, 'sugestao');
    expect(screen.getByText('ela faz b')).toBeInTheDocument();
    expect(screen.queryByText('ela faz c')).not.toBeInTheDocument();
  });

  it('lição nova exige os dois campos e grava o tema', async () => {
    const { l } = abrir([]);
    const botao = screen.getByRole('button', { name: 'Adicionar lição' });
    expect(botao).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Quando'), 'o lead pergunta o preço');
    expect(botao).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Ela'), 'diz a entrada primeiro');
    await userEvent.selectOptions(screen.getByLabelText('Tema'), 'preco');
    await userEvent.click(botao);
    expect(l.criar).toHaveBeenCalledWith('rule', 'diz a entrada primeiro', 'o lead pergunta o preço', { topic: 'preco' });
  });

  it('adicionar trava enquanto grava (clique duplo)', async () => {
    let soltar!: (v: boolean) => void;
    const criar = vi.fn(() => new Promise<boolean>((r) => { soltar = r; }));
    abrir([], { criar });
    await userEvent.type(screen.getByLabelText('Quando'), 'x');
    await userEvent.type(screen.getByLabelText('Ela'), 'y');
    const botao = screen.getByRole('button', { name: 'Adicionar lição' });
    await userEvent.click(botao);
    await userEvent.click(botao);
    expect(criar).toHaveBeenCalledTimes(1);
    await act(async () => { soltar(true); });
  });

  it('a bolinha do trilho é o fora_por_tamanho, mas o aviso da página também fala', () => {
    abrir([L('a', { in_use: false })], { contadores: { regras: contador({ valendo: 0, fora_por_tamanho: 1 }), exemplos: contador({ cabem: 20 }) } });
    expect(screen.getByText('Não está valendo')).toBeInTheDocument();
  });

  it('a chave pausa; excluir pede confirmação', async () => {
    const { l, confirmar } = abrir([L('a')]);
    await userEvent.click(screen.getByRole('switch', { name: /ela faz a/ }));
    expect(l.atualizar).toHaveBeenCalledWith('a', { enabled: false });
    await userEvent.click(screen.getByRole('button', { name: 'Ações da lição ela faz a' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Excluir lição', rotuloDaAcao: 'Excluir' }));
    expect(l.apagar).toHaveBeenCalledWith('a');
  });

  it('editar muda o quando, o que ela faz e o tema', async () => {
    const { l } = abrir([L('a')]);
    await userEvent.click(screen.getByRole('button', { name: 'Ações da lição ela faz a' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const ela = screen.getByLabelText('Editar o que ela faz');
    await userEvent.clear(ela);
    await userEvent.type(ela, 'novo texto');
    await userEvent.selectOptions(screen.getByLabelText('Tema da lição'), 'tom');
    await userEvent.click(screen.getByRole('button', { name: 'Pronto' }));
    expect(l.atualizar).toHaveBeenCalledWith('a', { content: 'novo texto', context: 'quando a', topic: 'tom' });
  });

  it('vazio, erro e carregando', async () => {
    const { l } = abrir([], { estado: 'erro' });
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(l.carregar).toHaveBeenCalled();
  });

  it('só mostra regras (exemplos ficam na outra página)', () => {
    abrir([L('a'), L('b', { kind: 'good_example' })]);
    expect(screen.queryByText('ela faz b')).not.toBeInTheDocument();
  });

  it('filtro sem lição mostra o vazio compacto, e Limpar filtros volta', async () => {
    abrir([L('a')]);
    await userEvent.click(screen.getByRole('tab', { name: /Visita/ }));
    expect(screen.getByText('Nenhuma lição neste filtro.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('ela faz a')).toBeInTheDocument();
  });
});
