import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SequenceEntries } from './SequenceEntries';

const getEntries = vi.fn();
const saveEntry = vi.fn();
const deleteEntry = vi.fn();

vi.mock('@/services/followupSequences/followupSequencesService', () => ({
  followupSequencesService: {
    getEntries: (...args: unknown[]) => getEntries(...args),
    saveEntry: (...args: unknown[]) => saveEntry(...args),
    deleteEntry: (...args: unknown[]) => deleteEntry(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const KINDS = [
  { value: 'stage', label: 'Card entrou numa coluna', needs: 'stage_id' },
  { value: 'label', label: 'Etiqueta foi adicionada', needs: 'label' },
  { value: 'new_lead', label: 'Lead novo chegou', needs: 'paid_only' },
  { value: 'visit_completed', label: 'Visita realizada', needs: null },
];

const STAGES = [
  { id: 'stage-1', name: 'Contato', pipeline_id: 'p1', pipeline_name: 'Vendas' },
  { id: 'stage-2', name: 'Visita agendada', pipeline_id: 'p1', pipeline_name: 'Vendas' },
  { id: 'stage-3', name: 'Contato', pipeline_id: 'p2', pipeline_name: 'Locação' },
];

const payload = (entries: unknown[] = []) => ({
  entries,
  kinds: KINDS,
  stages: STAGES,
  labels: ['visitou', 'proposta'],
});

describe('Quando este funil começa', () => {
  beforeEach(() => {
    getEntries.mockReset();
    saveEntry.mockReset();
    deleteEntry.mockReset();
    getEntries.mockResolvedValue(payload());
    saveEntry.mockResolvedValue({});
  });

  // Funil ainda não salvo não tem onde pendurar a entrada. Mostrar o formulário
  // aqui daria um erro no salvar, sem a pessoa entender o porquê.
  it('pede pra salvar o funil antes, quando ele ainda não existe', async () => {
    render(<SequenceEntries sequenceId={null} sequenceName="Novo" />);

    expect(screen.getByText(/Salve o funil primeiro/i)).toBeInTheDocument();
    expect(getEntries).not.toHaveBeenCalled();
  });

  // Sem entrada o funil só roda no manual — e quem acabou de escrever 10 mensagens
  // acha que ligou o follow-up. O aviso é o que evita a espera por uma mensagem
  // que nunca sai.
  it('avisa que nada dispara sozinho quando não há entrada', async () => {
    render(<SequenceEntries sequenceId="1" sequenceName="Pós-visita" />);

    expect(await screen.findByText(/só roda quando alguém mandar/i)).toBeInTheDocument();
  });

  it('lista as entradas já configuradas com o detalhe de cada uma', async () => {
    getEntries.mockResolvedValue(payload([
      { id: 10, kind: 'stage', label: 'Card entrou numa coluna', enabled: true, stage_id: 'stage-2', paid_only: false },
      { id: 11, kind: 'label', label: 'Etiqueta foi adicionada', enabled: false, tag: 'visitou', paid_only: false },
    ]));

    render(<SequenceEntries sequenceId="1" sequenceName="Pós-visita" />);

    expect(await screen.findByText('Vendas → Visita agendada')).toBeInTheDocument();
    expect(screen.getByText('etiqueta "visitou"')).toBeInTheDocument();
    expect(screen.getByText('desligada')).toBeInTheDocument();
  });

  it('só pede a coluna quando o gatilho é por coluna', async () => {
    const user = userEvent.setup();
    render(<SequenceEntries sequenceId="1" sequenceName="Pós-visita" />);

    await user.click(await screen.findByRole('button', { name: /Adicionar entrada/i }));
    expect(screen.getByLabelText('Coluna que inicia o funil')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('O que faz o funil começar'), 'label');
    expect(screen.queryByLabelText('Coluna que inicia o funil')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Etiqueta que inicia o funil')).toBeInTheDocument();
  });

  // O disparo por silêncio saiu em 2026-08-13, até o fluxo por coluna estar
  // validado. Este exemplo trava a retirada: se o gatilho voltar sozinho pra lista,
  // volta junto a configuração que não dispara nada.
  it('não oferece disparo por falta de resposta', async () => {
    const user = userEvent.setup();
    render(<SequenceEntries sequenceId="1" sequenceName="Pós-visita" />);

    await user.click(await screen.findByRole('button', { name: /Adicionar entrada/i }));

    const options = [...screen.getByLabelText('O que faz o funil começar').querySelectorAll('option')];
    expect(options.map(o => o.textContent)).not.toContain('Lead não respondeu');
  });

  it('manda a coluna escolhida ao salvar a entrada', async () => {
    const user = userEvent.setup();
    render(<SequenceEntries sequenceId="1" sequenceName="Pós-visita" />);

    await user.click(await screen.findByRole('button', { name: /Adicionar entrada/i }));
    await user.selectOptions(screen.getByLabelText('Coluna que inicia o funil'), 'stage-2');
    await user.click(screen.getByRole('button', { name: /Salvar entrada/i }));

    await waitFor(() => expect(saveEntry).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ kind: 'stage', stage_id: 'stage-2', enabled: true }),
    ));
  });

  // Trocar de gatilho tem que zerar o detalhe do anterior: sem isso a coluna
  // escolhida antes viajaria junto com um gatilho de etiqueta e o backend gravaria
  // uma condição que a tela não mostra.
  it('esquece o detalhe do gatilho anterior ao trocar de gatilho', async () => {
    const user = userEvent.setup();
    render(<SequenceEntries sequenceId="1" sequenceName="Pós-visita" />);

    await user.click(await screen.findByRole('button', { name: /Adicionar entrada/i }));
    await user.selectOptions(screen.getByLabelText('Coluna que inicia o funil'), 'stage-2');
    await user.selectOptions(screen.getByLabelText('O que faz o funil começar'), 'visit_completed');
    await user.click(screen.getByRole('button', { name: /Salvar entrada/i }));

    await waitFor(() => expect(saveEntry).toHaveBeenCalled());
    expect(saveEntry.mock.calls[0][1]).not.toHaveProperty('stage_id');
  });

  it('agrupa as colunas por pipeline — o mesmo nome existe em mais de um', async () => {
    const user = userEvent.setup();
    render(<SequenceEntries sequenceId="1" sequenceName="Pós-visita" />);

    await user.click(await screen.findByRole('button', { name: /Adicionar entrada/i }));

    const groups = screen.getByLabelText('Coluna que inicia o funil').querySelectorAll('optgroup');
    expect([...groups].map(g => g.getAttribute('label'))).toEqual(['Vendas', 'Locação']);
  });

  it('avisa que o lead recebe um funil por vez quando há mais de uma porta', async () => {
    getEntries.mockResolvedValue(payload([
      { id: 10, kind: 'stage', label: 'Card entrou numa coluna', enabled: true, stage_id: 'stage-2', paid_only: false },
      { id: 11, kind: 'visit_completed', label: 'Visita realizada', enabled: true, paid_only: false },
    ]));

    render(<SequenceEntries sequenceId="1" sequenceName="Pós-visita" />);

    expect(await screen.findByText(/um funil por vez/i)).toBeInTheDocument();
  });
});
