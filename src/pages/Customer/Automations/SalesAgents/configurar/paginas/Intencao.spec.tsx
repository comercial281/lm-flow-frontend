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

  const proprio = (nome: string, ativo = false): CaminhoDaIntencao => ({ nome, sinais: '', como: 'x', ativo });
  const salvar = () => screen.getByRole('button', { name: 'Salvar' });

  it('mostra o catálogo em chips; clicar desmarca e grava a lista inteira na mesma ordem', async () => {
    const gravar = abrir();
    expect(screen.getByRole('button', { name: 'Marcar o caminho Moradia' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Marcar o caminho Primeiro imóvel' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar o caminho Investimento' }));
    expect(gravar.mock.calls[0][1]).toEqual(['playbook.vars.caminhos_intencao']);
    const lista = listaGravada(gravar);
    expect(lista.map((c) => c.chave)).toEqual(['moradia', 'investimento', 'primeiro_imovel', 'troca']);
    expect(lista.filter((c) => c.ativo).map((c) => c.chave)).toEqual(['moradia']);
  });

  it('no máximo 5 marcados: o chip desmarcado trava', () => {
    const lista = [...catalogo(['moradia', 'investimento', 'primeiro_imovel', 'troca']), proprio('P1', true), proprio('P2')];
    abrir(agente({ playbook: { vars: { caminhos_intencao: lista } } }));
    expect(screen.getByRole('button', { name: 'Marcar o caminho P2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Marcar o caminho P1' })).not.toBeDisabled();
  });

  it('o resumo diz o que ela faz conforme os marcados', () => {
    abrir();
    expect(screen.getByText(/ela pergunta e descobre o caminho/)).toBeInTheDocument();
  });

  it('o lápis abre a janela com os valores; editar e Salvar grava a lista uma vez', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Editar o caminho Moradia' }));
    expect(screen.getByLabelText('Nome do caminho')).toHaveValue('Moradia');
    expect(screen.getByLabelText('Como reconhecer')).toHaveValue('família');
    expect(screen.getByLabelText('Como ela conduz')).toHaveValue('Descubra pra quem é.');
    await userEvent.clear(screen.getByLabelText('Como reconhecer'));
    await userEvent.type(screen.getByLabelText('Como reconhecer'), 'filhos');
    await userEvent.clear(screen.getByLabelText('Como ela conduz'));
    await userEvent.type(screen.getByLabelText('Como ela conduz'), 'Pergunte as salas.');
    expect(gravar).not.toHaveBeenCalled();
    await userEvent.click(salvar());
    expect(gravar).toHaveBeenCalledTimes(1);
    const lista = listaGravada(gravar);
    expect(lista[0]).toMatchObject({ chave: 'moradia', nome: 'Moradia', sinais: 'filhos', como: 'Pergunte as salas.', ativo: true });
    expect(lista.map((c) => c.chave)).toEqual(['moradia', 'investimento', 'primeiro_imovel', 'troca']);
  });

  it('Cancelar não grava', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Editar o caminho Moradia' }));
    await userEvent.type(screen.getByLabelText('Como reconhecer'), ' mais');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(gravar).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Salvar fica travado com "Como ela conduz" vazio', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Editar o caminho Moradia' }));
    await userEvent.clear(screen.getByLabelText('Como ela conduz'));
    expect(salvar()).toBeDisabled();
    expect(screen.getByText('Escreva como ela conduz quem segue este caminho.')).toBeInTheDocument();
  });

  it('caminho do catálogo não se remove; o próprio sim', async () => {
    const gravar = abrir(agente({ playbook: { vars: { caminhos_intencao: [...catalogo(['moradia']), proprio('Já mora no Castelo', true)] } } }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar o caminho Moradia' }));
    expect(screen.queryByRole('button', { name: 'Remover caminho' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Editar o caminho Já mora no Castelo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remover caminho' }));
    expect(listaGravada(gravar).map((c) => c.nome)).toEqual(['Moradia', 'Investimento', 'Primeiro imóvel', 'Trocar de imóvel']);
  });

  it('"Novo caminho" abre vazio e Salvar entra no fim, desmarcado', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('button', { name: /Novo caminho/ }));
    expect(salvar()).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Nome do caminho'), 'Já mora no Castelo');
    expect(salvar()).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Como ela conduz'), 'Pergunte as salas.');
    await userEvent.click(salvar());
    const lista = listaGravada(gravar);
    expect(lista).toHaveLength(5);
    expect(lista.at(-1)).toEqual({ nome: 'Já mora no Castelo', sinais: '', como: 'Pergunte as salas.', ativo: false });
  });

  it('nome repetido (sem diferença de caixa) bloqueia o Salvar', async () => {
    const gravar = abrir();
    await userEvent.click(screen.getByRole('button', { name: /Novo caminho/ }));
    await userEvent.type(screen.getByLabelText('Nome do caminho'), 'moradia');
    await userEvent.type(screen.getByLabelText('Como ela conduz'), 'x');
    expect(screen.getByText('Já existe um caminho com esse nome.')).toBeInTheDocument();
    expect(salvar()).toBeDisabled();
    expect(gravar).not.toHaveBeenCalled();
  });

  it('com 8 guardados o "Novo caminho" trava', () => {
    const lista = [...catalogo(['moradia']), proprio('A'), proprio('B'), proprio('C'), proprio('D')];
    abrir(agente({ playbook: { vars: { caminhos_intencao: lista } } }));
    expect(screen.getByRole('button', { name: /Novo caminho/ })).toBeDisabled();
  });

  it('"Voltar ao padrão" grava o padrão do tipo de venda', async () => {
    const padrao = catalogo(['moradia', 'troca']);
    const gravar = abrir(agente({ intent_paths_padrao: padrao, playbook: { vars: { caminhos_intencao: catalogo(['moradia']) } } }));
    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    expect(gravar.mock.calls[0][0]).toEqual({ playbook: { vars: { caminhos_intencao: padrao } } });
  });

  it('lead fora dos caminhos grava a subchave; "Atender mesmo assim" também grava explícito', async () => {
    const gravar = abrir(agente({ playbook: { vars: { fora_dos_caminhos: 'encerrar' } } }));
    await userEvent.click(screen.getByRole('radio', { name: 'Atender mesmo assim' }));
    expect(gravar).toHaveBeenCalledWith({ playbook: { vars: { fora_dos_caminhos: 'atender' } } }, ['playbook.vars.fora_dos_caminhos']);
  });

  it('sem nada gravado, abre com a opção que o servidor diz ser o padrão', () => {
    abrir(agente({ fora_dos_caminhos_padrao: 'passar' }));
    expect(screen.getByRole('radio', { name: 'Passar pro destino (roleta ou corretor)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Atender mesmo assim' })).not.toBeChecked();
  });

  it('padrão atender: abre com Atender marcado', () => {
    abrir(agente({ fora_dos_caminhos_padrao: 'atender' }));
    expect(screen.getByRole('radio', { name: 'Atender mesmo assim' })).toBeChecked();
  });

  it('sem padrão do servidor: abre em Passar', () => {
    abrir();
    expect(screen.getByRole('radio', { name: 'Passar pro destino (roleta ou corretor)' })).toBeChecked();
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
