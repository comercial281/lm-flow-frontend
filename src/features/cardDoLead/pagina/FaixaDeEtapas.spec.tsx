// src/features/cardDoLead/pagina/FaixaDeEtapas.spec.tsx
// Decisão 16: clicar numa etapa move o card, mas pede confirmação — um clique
// errado distorce os dias por etapa. Card fechado: a faixa só informa.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FaixaDeEtapas from './FaixaDeEtapas';

const etapas = [
  { id: 's1', name: 'Novo', color: '#3b82f6', position: 1 },
  { id: 's2', name: '1º contato', color: '#22c55e', position: 2 },
  { id: 's3', name: 'Proposta', color: '#f59e0b', position: 3 },
  // A coluna do Ganho (ajuste de 08/10): tipo Concluída.
  { id: 's9', name: 'Concluído', color: '#10b981', position: 9, stage_type: 'completed' },
] as never;
const duracoes = [
  { stage_id: 's1', days: 2, current: false },
  { stage_id: 's2', days: 14, current: true },
];

function montar(props: Partial<Parameters<typeof FaixaDeEtapas>[0]> = {}) {
  const aoMover = vi.fn().mockResolvedValue(undefined);
  const aoGanhar = vi.fn().mockResolvedValue(undefined);
  render(
    <FaixaDeEtapas
      etapas={etapas}
      etapaAtualId="s2"
      duracoes={duracoes}
      fechado={false}
      nomeDoLead="Maria Souza"
      movendo={false}
      aoMover={aoMover}
      aoGanhar={aoGanhar}
      {...props}
    />,
  );
  return { aoMover, aoGanhar };
}

describe('FaixaDeEtapas', () => {
  it('mostra os dias de cada etapa visitada e marca a atual', () => {
    montar();
    expect(screen.getByText('2 dias')).toBeInTheDocument();
    expect(screen.getByText('14 dias · atual')).toBeInTheDocument();
    expect(screen.getByText('1º contato').closest('li')).toHaveAttribute('aria-current', 'step');
    // O leitor de tela ouve os dias, e Concluído diz que marca Ganho.
    expect(screen.getByRole('button', { name: 'Mover para Novo · 2 dias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mover para Proposta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar como Ganho (Concluído)' })).toBeInTheDocument();
  });

  // 08/10: etapa que o lead só atravessou (ex.: saiu do Follow-up Automático no
  // mesmo dia porque respondeu) fica só pintada, sem "menos de 1 dia".
  it('etapa já passada com menos de 1 dia: só pintada, sem texto de dias', () => {
    montar({
      etapaAtualId: 's3',
      duracoes: [
        { stage_id: 's1', days: 2, current: false },
        { stage_id: 's2', days: 0, current: false },
        { stage_id: 's3', days: 0, current: true },
      ],
    });
    const passada = screen.getByText('1º contato').closest('li')!;
    expect(passada).not.toHaveTextContent('menos de 1 dia');
    expect(screen.getByRole('button', { name: 'Mover para 1º contato' })).toHaveClass('bg-primary/10');
    // Na etapa atual continua dizendo que ele entrou hoje.
    expect(screen.getByText('menos de 1 dia · atual')).toBeInTheDocument();
  });

  it('clicar numa etapa pergunta antes e só move no "Mover"', async () => {
    const { aoMover } = montar();
    await userEvent.click(screen.getByRole('button', { name: /^Mover para Proposta( ·|$)/ }));

    expect(await screen.findByRole('dialog', { name: 'Mover Maria Souza para Proposta?' })).toBeInTheDocument();
    expect(aoMover).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Mover' }));

    await waitFor(() => expect(aoMover).toHaveBeenCalledWith('s3'));
  });

  it('cancelar não move', async () => {
    const { aoMover } = montar();
    await userEvent.click(screen.getByRole('button', { name: /^Mover para Novo( ·|$)/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(aoMover).not.toHaveBeenCalled();
  });

  it('a etapa atual não é botão', () => {
    montar();
    expect(screen.queryByRole('button', { name: /^Mover para 1º contato( ·|$)/ })).toBeNull();
  });

  it('card fechado: a faixa só informa', () => {
    montar({ fechado: true });
    expect(screen.queryByRole('button', { name: /Mover para/ })).toBeNull();
    expect(screen.getByText('Lead fechado não muda de etapa. Reabra para mexer.')).toBeInTheDocument();
    expect(screen.getByText('2 dias')).toBeInTheDocument();
  });

  it('enquanto move, nenhuma etapa aceita clique', () => {
    montar({ movendo: true });
    expect(screen.getByRole('button', { name: /^Mover para Proposta( ·|$)/ })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Mudando de etapa');
  });

  // Ajuste de 08/10: Concluído é a coluna do Ganho.
  it('clicar em Concluído pergunta "Marcar <nome> como Ganho?" e marca Ganho (não move)', async () => {
    const { aoMover, aoGanhar } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como Ganho (Concluído)' }));

    expect(await screen.findByRole('dialog', { name: 'Marcar Maria Souza como Ganho?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como Ganho' }));

    await waitFor(() => expect(aoGanhar).toHaveBeenCalledTimes(1));
    expect(aoMover).not.toHaveBeenCalled();
  });

  it('a coluna Concluído não mostra dias, mesmo visitada', () => {
    montar({ fechado: true, etapaAtualId: 's9', duracoes: [...duracoes, { stage_id: 's9', days: 0, current: true }] });
    const concluido = screen.getByText('Concluído').closest('li')!;
    expect(concluido).toHaveAttribute('aria-current', 'step');
    expect(concluido).toHaveTextContent('atual');
    expect(concluido).not.toHaveTextContent('menos de 1 dia');
  });
});
