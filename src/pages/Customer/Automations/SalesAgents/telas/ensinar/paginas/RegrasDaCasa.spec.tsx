import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import RegrasDaCasa from './RegrasDaCasa';

const FRASE = 'Regras da casa não aceita apresentação: quem a IA é fica na ficha, em Números e usuários.';

function abrir(extra: Partial<SalesAgent> = {}, gravar = gravarDeTeste('ensinar')) {
  const confirmar = vi.fn().mockResolvedValue(true);
  render(<RegrasDaCasa agent={agenteDeTeste(extra)} gravar={gravar} licoes={{} as never} arquivos={{} as never} irPara={vi.fn()} confirmar={confirmar} />);
  return { gravar, confirmar };
}
const linhas = (n: number) => Array.from({ length: n }, (_, i) => `Regra ${i + 1}`);

beforeEach(() => vi.clearAllMocks());

describe('Regras da casa', () => {
  it('mostra "N de 30" e as regras', () => {
    abrir({ house_rules: ['Nunca prometa aprovação', 'Fale simples'] });
    expect(screen.getByText('2 de 30')).toBeInTheDocument();
    expect(screen.getByText('Nunca prometa aprovação')).toBeInTheDocument();
  });

  it('adicionar grava a lista inteira com a nova no fim, só em house_rules', async () => {
    const { gravar } = abrir({ house_rules: ['A'] });
    await userEvent.type(screen.getByLabelText('Nova regra'), 'Responda curto');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar regra' }));
    expect(gravar).toHaveBeenCalledWith({ house_rules: ['A', 'Responda curto'] });
  });

  it('a 31ª não entra', async () => {
    const { gravar } = abrir({ house_rules: linhas(30) });
    expect(screen.getByText('30 de 30')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nova regra'), 'Mais uma');
    expect(screen.getByRole('button', { name: 'Adicionar regra' })).toBeDisabled();
    expect(screen.getByText(/Chegou em 30 regras/)).toBeInTheDocument();
    expect(gravar).not.toHaveBeenCalled();
  });

  it('linha acima de 200 não grava', async () => {
    const { gravar } = abrir({ house_rules: [] });
    await userEvent.click(screen.getByLabelText('Nova regra'));
    await userEvent.paste('a'.repeat(201));
    expect(screen.getByRole('button', { name: 'Adicionar regra' })).toBeDisabled();
    expect(screen.getByText('Cada regra tem no máximo 200 caracteres.')).toBeInTheDocument();
    expect(gravar).not.toHaveBeenCalled();
  });

  it('apresentação é recusada antes de gravar, com a frase da casa', async () => {
    const { gravar } = abrir({ house_rules: [] });
    await userEvent.type(screen.getByLabelText('Nova regra'), 'Sou a Thaís, gerente');
    expect(screen.getByRole('button', { name: 'Adicionar regra' })).toBeDisabled();
    expect(screen.getByText(FRASE)).toBeInTheDocument();
    expect(gravar).not.toHaveBeenCalled();
  });

  it('valor em reais avisa que mora no cadastro, mas deixa gravar', async () => {
    const { gravar } = abrir({ house_rules: [] });
    await userEvent.type(screen.getByLabelText('Nova regra'), 'Entrada de R$ 500');
    expect(screen.getByText('Condição e imóvel moram no cadastro ou na campanha.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar regra' }));
    expect(gravar).toHaveBeenCalledWith({ house_rules: ['Entrada de R$ 500'] });
  });

  it('o aviso que o servidor devolveu aparece na página', () => {
    abrir({ house_rules: ['Ofereça o AB01'], house_rules_notices: ['Condição e imóvel moram no cadastro ou na campanha.'] });
    expect(screen.getByRole('status')).toHaveTextContent('Condição e imóvel moram no cadastro ou na campanha.');
  });

  it('se o servidor recusar, o texto fica no campo (a frase dele sai no aviso da gravação)', async () => {
    const gravar = gravarDeTeste('ensinar');
    gravar.falhar();
    abrir({ house_rules: [] }, gravar);
    await userEvent.type(screen.getByLabelText('Nova regra'), 'Fale simples');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar regra' }));
    expect(gravar).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText('Nova regra')).toHaveValue('Fale simples'));
  });

  it('editar e excluir regra', async () => {
    const { gravar, confirmar } = abrir({ house_rules: ['A', 'B'] });
    await userEvent.click(screen.getByRole('button', { name: 'Ações da regra A' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    const campo = screen.getByLabelText('Editar regra');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'A2');
    await userEvent.click(screen.getByRole('button', { name: 'Pronto' }));
    expect(gravar).toHaveBeenLastCalledWith({ house_rules: ['A2', 'B'] });
    await userEvent.click(screen.getByRole('button', { name: 'Ações da regra B' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Excluir regra da casa' }));
    expect(gravar).toHaveBeenLastCalledWith({ house_rules: ['A'] });
  });
});

describe('Objeções da casa', () => {
  it('adicionar grava a objeção com a resposta, só em house_objections', async () => {
    const { gravar } = abrir({ house_objections: [] });
    await userEvent.type(screen.getByLabelText('Objeção'), 'Achei caro');
    await userEvent.type(screen.getByLabelText('Resposta da casa'), 'Mostre a parcela antes do valor total.');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar objeção' }));
    expect(gravar).toHaveBeenCalledWith({ house_objections: [{ objecao: 'Achei caro', resposta: 'Mostre a parcela antes do valor total.' }] });
  });

  it('exige as duas partes', async () => {
    abrir({ house_objections: [] });
    await userEvent.type(screen.getByLabelText('Objeção'), 'Achei caro');
    expect(screen.getByRole('button', { name: 'Adicionar objeção' })).toBeDisabled();
  });

  it('até 10: a 11ª não entra', async () => {
    const dez = Array.from({ length: 10 }, (_, i) => ({ objecao: `O${i}`, resposta: `R${i}` }));
    abrir({ house_objections: dez });
    expect(screen.getByText('10 de 10')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Objeção'), 'x');
    await userEvent.type(screen.getByLabelText('Resposta da casa'), 'y');
    expect(screen.getByRole('button', { name: 'Adicionar objeção' })).toBeDisabled();
  });

  it('excluir confirma e grava a lista sem ela', async () => {
    const { gravar, confirmar } = abrir({ house_objections: [{ objecao: 'Achei caro', resposta: 'Mostre a parcela' }] });
    await userEvent.click(screen.getByRole('button', { name: 'Ações da objeção Achei caro' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(confirmar).toHaveBeenCalled();
    expect(gravar).toHaveBeenCalledWith({ house_objections: [] });
  });
});
