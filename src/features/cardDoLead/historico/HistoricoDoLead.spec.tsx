// src/features/cardDoLead/historico/HistoricoDoLead.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoricoDoLead from './HistoricoDoLead';
import { quandoAcontece } from '@/lib/formato';
import type { LeadTimelineEvent } from '@/services/contacts/leadTimelineService';

const list = vi.hoisted(() => vi.fn());
vi.mock('@/services/contacts/leadTimelineService', () => ({ leadTimelineService: { list } }));
const criarNota = vi.hoisted(() => vi.fn());
vi.mock('@/services/notes/notesService', () => ({ notesService: { create: criarNota } }));
const avisoDeErro = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: avisoDeErro } }));

const QUANDO = '2026-10-12T17:32:00.000000Z';
const ev = (over: Partial<LeadTimelineEvent> = {}): LeadTimelineEvent => ({
  id: 'mov-1',
  category: 'alteracao',
  kind: 'stage_changed',
  title: 'Mudou de etapa',
  detail: 'Novo → 1º contato',
  actor: 'Ana Corretora',
  occurred_at: QUANDO,
  pipeline_name: 'Leads (Marketing)',
  tone: 'neutral',
  ...over,
});
const pagina = (events: LeadTimelineEvent[], next_before: string | null = null) => ({ events, next_before });
const nomesDosFiltros = () =>
  within(screen.getByRole('group', { name: 'Filtrar o histórico' })).getAllByRole('button').map(b => b.textContent);

beforeEach(() => {
  list.mockReset();
  criarNota.mockReset();
  avisoDeErro.mockReset();
});

describe('HistoricoDoLead compacto (janela do card)', () => {
  it('desenha título, detalhe e "por Fulano · quando" do jeito que o servidor mandou', async () => {
    list.mockResolvedValue(pagina([ev()]));
    render(<HistoricoDoLead contactId="c1" modo="compacto" funilAtual="Leads (Marketing)" />);

    expect(await screen.findByText('Mudou de etapa')).toBeInTheDocument();
    expect(screen.getByText('Novo → 1º contato')).toBeInTheDocument();
    expect(screen.getByText(`por Ana Corretora · ${quandoAcontece(QUANDO)}`)).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith('c1', { category: 'resumo' });
  });

  it('Perdido em vermelho, Ganho em verde', async () => {
    list.mockResolvedValue(pagina([
      ev({ id: 'status-1', kind: 'status_lost', category: 'resumo', title: 'Perdido', detail: 'Adiou a compra', tone: 'danger' }),
      ev({ id: 'status-2', kind: 'status_won', category: 'resumo', title: 'Ganho', detail: null, tone: 'success' }),
    ]));
    render(<HistoricoDoLead contactId="c1" modo="compacto" />);

    expect(await screen.findByText('Perdido')).toHaveClass('text-destructive');
    expect(screen.getByText('Ganho')).toHaveClass('text-lm-success');
    expect(screen.getByText('Perdido').closest('li')).toHaveAttribute('data-tom', 'danger');
  });

  it('evento de outro funil diz o nome do funil; do mesmo funil, não', async () => {
    list.mockResolvedValue(pagina([
      ev({ id: 'a', actor: null, pipeline_name: 'Locação' }),
      ev({ id: 'b', actor: null, title: 'Entrou no funil', kind: 'pipeline_entered', detail: 'Na etapa Novo' }),
    ]));
    render(<HistoricoDoLead contactId="c1" modo="compacto" funilAtual="Leads (Marketing)" />);

    await screen.findByText('Entrou no funil');
    expect(screen.getByText(`${quandoAcontece(QUANDO)} · funil Locação`)).toBeInTheDocument();
    expect(screen.getByText(quandoAcontece(QUANDO))).toBeInTheDocument();
  });

  it('não tem filtro Observações nem linha de nota: as Observações ficam na caixa ao lado', async () => {
    list.mockResolvedValue(pagina([
      ev(),
      ev({ id: 'note-1', kind: 'note_added', category: 'observacao', title: 'Observação adicionada', detail: 'Ligar às 18h' }),
    ]));
    render(<HistoricoDoLead contactId="c1" modo="compacto" />);

    await screen.findByText('Mudou de etapa');
    expect(screen.queryByText('Ligar às 18h')).not.toBeInTheDocument();
    expect(nomesDosFiltros()).toEqual(['Tudo', 'Atividades', 'Rodízios', 'Alterações']);
    expect(screen.queryByRole('textbox', { name: 'Escrever observação' })).not.toBeInTheDocument();
  });

  it('trocar o filtro pede a categoria ao servidor; clicar no filtro ligado volta para o Tudo', async () => {
    list.mockResolvedValue(pagina([ev()]));
    render(<HistoricoDoLead contactId="c1" modo="compacto" />);
    await screen.findByText('Mudou de etapa');

    await userEvent.click(screen.getByRole('button', { name: 'Rodízios' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith('c1', { category: 'rodizio' }));
    expect(screen.getByRole('button', { name: 'Rodízios' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Rodízios' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith('c1', { category: 'resumo' }));
  });

  it('Carregar mais pede antes do último e junta embaixo, até acabar', async () => {
    list
      .mockResolvedValueOnce(pagina([ev({ id: 'a', title: 'Primeiro' })], 'cursor-1'))
      .mockResolvedValueOnce(pagina([ev({ id: 'b', title: 'Segundo' })], null));
    render(<HistoricoDoLead contactId="c1" modo="compacto" />);
    await screen.findByText('Primeiro');

    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByText('Segundo')).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith('c1', { category: 'resumo', before: 'cursor-1' });
    expect(screen.getByText('Primeiro')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('erro não vira lista vazia: mostra o erro e tenta de novo', async () => {
    list.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(pagina([ev()]));
    render(<HistoricoDoLead contactId="c1" modo="compacto" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Mudou de etapa')).toBeInTheDocument();
  });

  it('vazio fala do filtro escolhido', async () => {
    list.mockResolvedValue(pagina([]));
    render(<HistoricoDoLead contactId="c1" modo="compacto" />);

    expect(await screen.findByText('Nada registrado ainda')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Rodízios' }));
    expect(await screen.findByText('Este lead não passou pela roleta')).toBeInTheDocument();
  });

  it('recarrega do começo quando a versão muda', async () => {
    list.mockResolvedValue(pagina([ev()]));
    const { rerender } = render(<HistoricoDoLead contactId="c1" modo="compacto" versao="0|s1" />);
    await screen.findByText('Mudou de etapa');

    rerender(<HistoricoDoLead contactId="c1" modo="compacto" versao="0|s2" />);

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  // Veio do useCardDoLead (P4-T5): desde a E5 quem busca o Histórico é este componente.
  it('resposta atrasada do card anterior não aparece no card novo', async () => {
    let soltarA: (v: unknown) => void = () => {};
    list
      .mockImplementationOnce(() => new Promise(r => { soltarA = r; }))
      .mockResolvedValueOnce(pagina([ev({ id: 'evB', title: 'Do card novo' })]));
    const { rerender } = render(<HistoricoDoLead contactId="c1" modo="compacto" />);
    await waitFor(() => expect(list).toHaveBeenCalledWith('c1', { category: 'resumo' }));

    rerender(<HistoricoDoLead contactId="c4" modo="compacto" />);
    expect(await screen.findByText('Do card novo')).toBeInTheDocument();

    await act(async () => {
      soltarA(pagina([ev({ id: 'evA', title: 'Do card velho' })]));
    });

    expect(screen.queryByText('Do card velho')).not.toBeInTheDocument();
    expect(screen.getByText('Do card novo')).toBeInTheDocument();
  });

  it('sem contato não pede nada', () => {
    render(<HistoricoDoLead contactId={null} modo="compacto" />);

    expect(screen.getByText('Sem contato vinculado para mostrar o histórico.')).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });
});

describe('HistoricoDoLead completo (página do card)', () => {
  it('tem a caixa de escrever no topo e Observações como filtro, com as notas na lista', async () => {
    list.mockResolvedValue(pagina([
      ev({ id: 'note-1', kind: 'note_added', category: 'observacao', title: 'Observação adicionada', detail: 'Ligar às 18h' }),
    ]));
    render(<HistoricoDoLead contactId="c1" modo="completo" />);

    expect(await screen.findByText('Ligar às 18h')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Escrever observação' })).toBeInTheDocument();
    expect(nomesDosFiltros()).toEqual(['Tudo', 'Atividades', 'Observações', 'Rodízios', 'Alterações']);
  });

  it('postar grava a observação e recarrega o histórico', async () => {
    list.mockResolvedValue(pagina([]));
    criarNota.mockResolvedValue({ id: 'n1' });
    render(<HistoricoDoLead contactId="c1" modo="completo" />);
    await screen.findByText('Nada registrado ainda');

    await userEvent.type(screen.getByRole('textbox', { name: 'Escrever observação' }), 'Volta de viagem dia 20');
    await userEvent.click(screen.getByRole('button', { name: 'Postar' }));

    expect(criarNota).toHaveBeenCalledWith('c1', { content: 'Volta de viagem dia 20' });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('textbox', { name: 'Escrever observação' })).toHaveValue('');
  });

  it('falha ao postar avisa e mantém o texto', async () => {
    list.mockResolvedValue(pagina([]));
    criarNota.mockRejectedValue(new Error('rede'));
    render(<HistoricoDoLead contactId="c1" modo="completo" />);
    await screen.findByText('Nada registrado ainda');

    await userEvent.type(screen.getByRole('textbox', { name: 'Escrever observação' }), 'Texto');
    await userEvent.click(screen.getByRole('button', { name: 'Postar' }));

    await waitFor(() => expect(avisoDeErro).toHaveBeenCalledWith('Não consegui salvar a observação'));
    expect(screen.getByRole('textbox', { name: 'Escrever observação' })).toHaveValue('Texto');
  });

  it('sem a função de Observações do cliente, nem caixa nem filtro', async () => {
    list.mockResolvedValue(pagina([]));
    render(<HistoricoDoLead contactId="c1" modo="completo" comObservacoes={false} />);
    await screen.findByText('Nada registrado ainda');

    expect(screen.queryByRole('textbox', { name: 'Escrever observação' })).not.toBeInTheDocument();
    expect(nomesDosFiltros()).toEqual(['Tudo', 'Atividades', 'Rodízios', 'Alterações']);
  });
});

describe('HistoricoDoLead — correções da revisão', () => {
  it('recarga no meio do "Carregar mais" não deixa o botão da lista nova travado', async () => {
    list
      .mockResolvedValueOnce(pagina([ev({ id: 'a', title: 'Primeiro' })], 'cursor-1'))
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce(pagina([ev({ id: 'r', title: 'Rodízio novo' })], 'cursor-2'));
    render(<HistoricoDoLead contactId="c1" modo="compacto" />);
    await screen.findByText('Primeiro');

    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Rodízios' }));

    expect(await screen.findByText('Rodízio novo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeEnabled();
  });

  it('compacto: página só de observações busca a próxima sozinho', async () => {
    const nota = (id: string) =>
      ev({ id, kind: 'note_added', category: 'observacao', title: 'Observação adicionada', detail: 'Ligar às 18h' });
    list
      .mockResolvedValueOnce(pagina([nota('n1'), nota('n2')], 'cursor-1'))
      .mockResolvedValueOnce(pagina([ev({ id: 'b', title: 'Segundo' })], null));
    render(<HistoricoDoLead contactId="c1" modo="compacto" />);

    expect(await screen.findByText('Segundo')).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith('c1', { category: 'resumo', before: 'cursor-1' });
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('compacto: o pulo sozinho tem limite e depois sobra o "Carregar mais"', async () => {
    let n = 0;
    list.mockImplementation(async () => {
      n += 1;
      return pagina(
        [ev({ id: `n${n}`, kind: 'note_added', category: 'observacao', title: 'Observação adicionada' })],
        `cursor-${n}`,
      );
    });
    render(<HistoricoDoLead contactId="c1" modo="compacto" />);

    expect(await screen.findByRole('button', { name: 'Carregar mais' })).toBeEnabled();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(4));
    await new Promise(r => setTimeout(r, 50));
    expect(list).toHaveBeenCalledTimes(4); // 1 carga + 3 pulos
  });

  it('Ctrl+Enter com a observação ainda salvando não posta em dobro', async () => {
    list.mockResolvedValue(pagina([]));
    criarNota.mockReturnValue(new Promise(() => {}));
    render(<HistoricoDoLead contactId="c1" modo="completo" />);
    await screen.findByText('Nada registrado ainda');

    const caixa = screen.getByRole('textbox', { name: 'Escrever observação' });
    await userEvent.type(caixa, 'Texto');
    await userEvent.type(caixa, '{Control>}{Enter}{/Control}');
    await userEvent.type(caixa, '{Control>}{Enter}{/Control}');

    expect(criarNota).toHaveBeenCalledTimes(1);
  });
});
