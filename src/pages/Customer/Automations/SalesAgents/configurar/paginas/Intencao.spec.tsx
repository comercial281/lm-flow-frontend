import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import Intencao from './Intencao';

const abrir = (agent = agenteDeTeste()) => {
  const gravar = gravarDeTeste('intencao');
  render(<><Intencao agent={agent} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>);
  return gravar;
};

describe('Intenção', () => {
  it('quando perguntar grava só a subchave do roteiro; "Não pergunta" esconde a pergunta', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Não pergunta, deduz' }));
    expect(gravar).toHaveBeenCalledWith(
      { playbook: { vars: { perguntas_situacao: ['Mora de aluguel?'] }, intent_question_mode: 'never' } },
      ['playbook.intent_question_mode'],
    );
  });

  it('sem lista gravada mostra os caminhos de fábrica; mexer em um grava a lista inteira', async () => {
    const gravar = abrir();
    expect(screen.getByText(/caminhos de fábrica/)).toBeInTheDocument();
    const nome = screen.getByLabelText('Resposta do caminho 1');
    expect(nome).toHaveValue('Moradia');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Morar');
    await userEvent.click(screen.getByText('fora'));
    const [mudanca, sub] = gravar.mock.calls[0];
    expect(sub).toEqual(['playbook.vars.caminhos_intencao']);
    expect((mudanca.playbook as { vars: { caminhos_intencao: { nome: string }[] } }).vars.caminhos_intencao.map((c) => c.nome))
      .toEqual(['Morar', 'Investimento', 'Sondando']);
  });

  it('até 5 caminhos; "Voltar aos de fábrica" apaga a lista própria', async () => {
    const proprios = Array.from({ length: 5 }, (_, i) => ({ nome: `C${i}`, como: 'x' }));
    const gravar = abrir(agenteDeTeste({ playbook: { vars: { caminhos_intencao: proprios } } }));
    expect(screen.getByRole('button', { name: 'Novo caminho' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar aos de fábrica' }));
    expect(gravar.mock.calls[0][0]).toEqual({ playbook: { vars: { caminhos_intencao: undefined } } });
  });
});
