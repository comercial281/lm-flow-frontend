import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import type { CaminhoDaIntencao, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import Intencao from './Intencao';

const catalogo = (marcados: string[]): CaminhoDaIntencao[] => [
  { chave: 'moradia', nome: 'Moradia', sinais: 'família', como: 'Descubra pra quem é.', ativo: marcados.includes('moradia') },
  { chave: 'investimento', nome: 'Investimento', sinais: 'renda', como: 'Foque em valorização.', ativo: marcados.includes('investimento') },
  { chave: 'primeiro_imovel', nome: 'Primeiro imóvel', sinais: 'aluguel', como: 'Renda e FGTS.', ativo: marcados.includes('primeiro_imovel') },
  { chave: 'troca', nome: 'Trocar de imóvel', sinais: 'já tem imóvel', como: 'Vende o atual?', ativo: marcados.includes('troca') },
];
const agente = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({
  intent_paths: catalogo(['moradia', 'investimento']), intent_paths_padrao: catalogo(['moradia', 'investimento']),
  intent_question_default: 'Pergunta gerada?', ...extra,
});

const abrir = (agent = agente()) => {
  const gravar = gravarDeTeste('intencao');
  render(<><Intencao agent={agent} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>);
  return gravar;
};
const listaGravada = (gravar: ReturnType<typeof gravarDeTeste>) =>
  (gravar.mock.calls[0][0].playbook as { vars: { caminhos_intencao: CaminhoDaIntencao[] } }).vars.caminhos_intencao;

describe('Intenção', () => {
  it('quando perguntar grava só a subchave do roteiro; "Não pergunta" esconde a pergunta', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('radio', { name: 'Não pergunta, deduz' }));
    expect(gravar).toHaveBeenCalledWith(
      { playbook: { vars: { perguntas_situacao: ['Mora de aluguel?'] }, intent_question_mode: 'never' } },
      ['playbook.intent_question_mode'],
    );
  });

  it('no modo "Não pergunta" a pergunta some', () => {
    abrir(agente({ playbook: { intent_question_mode: 'never' } }));
    expect(screen.queryByLabelText('Pergunta')).toBeNull();
  });

  it('a pergunta mostra a gerada pelos caminhos como exemplo', () => {
    abrir();
    expect(screen.getByLabelText('Pergunta')).toHaveAttribute('placeholder', 'Pergunta gerada?');
  });

  it('mostra o catálogo com caixinhas; desmarcar grava a lista inteira', async () => {
    const gravar = abrir();
    expect(screen.getByRole('checkbox', { name: 'Marcar o caminho Moradia' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Marcar o caminho Primeiro imóvel' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar o caminho Investimento' }));
    expect(gravar.mock.calls[0][1]).toEqual(['playbook.vars.caminhos_intencao']);
    const lista = listaGravada(gravar);
    expect(lista).toHaveLength(4);
    expect(lista.filter((c) => c.ativo).map((c) => c.chave)).toEqual(['moradia']);
  });

  it('editar "Como reconhecer" grava as pistas do caminho', async () => {
    const gravar = abrir();
    const campo = screen.getByLabelText('Como reconhecer o caminho Moradia');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'filhos');
    await userEvent.click(screen.getByText('fora'));
    expect(listaGravada(gravar)[0].sinais).toBe('filhos');
  });

  it('caminho do catálogo não se remove; o próprio sim', () => {
    abrir(agente({ playbook: { vars: { caminhos_intencao: [...catalogo(['moradia']), { nome: 'Já mora no Castelo', sinais: '', como: 'x', ativo: true }] } } }));
    expect(screen.queryByRole('button', { name: 'Remover o caminho Moradia' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remover o caminho Já mora no Castelo' })).toBeInTheDocument();
  });

  it('no máximo 5 marcados: a caixinha desmarcada trava', () => {
    const lista = [...catalogo(['moradia', 'investimento', 'primeiro_imovel', 'troca']),
      { nome: 'P1', como: 'x', ativo: true }, { nome: 'P2', como: 'x', ativo: false }];
    abrir(agente({ playbook: { vars: { caminhos_intencao: lista } } }));
    expect(screen.getByRole('checkbox', { name: 'Marcar o caminho P2' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Marcar o caminho P1' })).not.toBeDisabled();
  });

  it('"Novo caminho" entra desmarcado; até 8 guardados', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Novo caminho' }));
    expect(listaGravada(gravar).at(-1)).toEqual({
      nome: 'Novo caminho', sinais: '', como: 'Escreva como ela conduz quem segue este caminho.', ativo: false,
    });
  });

  it('cada "Novo caminho" ganha nome livre (sem repetir, sem diferença de caixa)', async () => {
    const proprio = (nome: string): CaminhoDaIntencao => ({ nome, sinais: '', como: 'x', ativo: false });
    const gravar = abrir(agente({ playbook: { vars: { caminhos_intencao: [...catalogo(['moradia']), proprio('Novo caminho'), proprio('novo caminho 2')] } } }));
    await userEvent.click(screen.getByRole('button', { name: 'Novo caminho' }));
    expect(listaGravada(gravar).at(-1)?.nome).toBe('Novo caminho 3');
  });

  it('o primeiro "Novo caminho" com a lista já tendo um ganha o 2', async () => {
    const gravar = abrir(agente({ playbook: { vars: { caminhos_intencao: [...catalogo(['moradia']), { nome: 'Novo caminho', sinais: '', como: 'x', ativo: false }] } } }));
    await userEvent.click(screen.getByRole('button', { name: 'Novo caminho' }));
    expect(listaGravada(gravar).at(-1)?.nome).toBe('Novo caminho 2');
  });

  it('"Voltar ao padrão" grava o padrão do tipo de venda', async () => {
    const padrao = catalogo(['moradia', 'troca']);
    const gravar = abrir(agente({ intent_paths_padrao: padrao, playbook: { vars: { caminhos_intencao: catalogo(['moradia']) } } }));
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    expect(gravar.mock.calls[0][0]).toEqual({ playbook: { vars: { caminhos_intencao: padrao } } });
  });

  it('lead fora dos caminhos grava a subchave; "Atender mesmo assim" apaga', async () => {
    const gravar = abrir(agente({ playbook: { vars: { fora_dos_caminhos: 'encerrar' } } }));
    await userEvent.click(screen.getByRole('radio', { name: 'Atender mesmo assim' }));
    expect(gravar).toHaveBeenCalledWith({ playbook: { vars: { fora_dos_caminhos: undefined } } }, ['playbook.vars.fora_dos_caminhos']);
  });

  it('caminho novo com o texto inicial não pode ser marcado até escrever', () => {
    const novo: CaminhoDaIntencao = { nome: 'Novo caminho', sinais: '', como: 'Escreva como ela conduz quem segue este caminho.', ativo: false };
    abrir(agente({ playbook: { vars: { caminhos_intencao: [...catalogo(['moradia']), novo, { ...novo, nome: 'Escrito', como: 'Pergunte as salas.' }] } } }));
    expect(screen.getByRole('checkbox', { name: 'Marcar o caminho Novo caminho' })).toBeDisabled();
    expect(screen.getByText('Escreva como ela conduz antes de marcar')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Marcar o caminho Escrito' })).not.toBeDisabled();
  });

  it('"Voltar ao padrão" some quando a lista já é o padrão', () => {
    abrir(agente({ playbook: { vars: { caminhos_intencao: catalogo(['moradia', 'investimento']) } } }));
    expect(screen.queryByRole('button', { name: 'Voltar ao padrão' })).toBeNull();
  });

  it('sem nenhum caminho marcado a seção "Lead que não cabe" some', () => {
    abrir(agente({ playbook: { vars: { caminhos_intencao: catalogo([]) } } }));
    expect(screen.queryByText('Lead que não cabe em nenhum caminho')).toBeNull();
  });
});
