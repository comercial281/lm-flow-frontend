import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { answersFromAgent } from '../assistenteMapping';
import EtapaRumo from './EtapaRumo';
import EtapaRevisao from './EtapaRevisao';

const agente = { id: 'ia-1', name: 'Sofia', visit_config: { days: [1, 2, 3], start: '09:00', end: '18:00' } } as unknown as SalesAgent;
const respostas = () => answersFromAgent(agente, null);

describe('assistente · etapa O rumo da conversa: quando a IA pode marcar visita', () => {
  it('chave da agenda desligada: dias e horário aparecem para editar', () => {
    render(<EtapaRumo a={respostas()} set={vi.fn()} playbook={null} />);

    expect(screen.getByRole('button', { name: 'Seg' })).toBeInTheDocument();
    expect(screen.getByLabelText('Das')).toBeInTheDocument();
    expect(screen.getByLabelText('até')).toBeInTheDocument();
    expect(screen.queryByText(/horário de visita da Agenda/)).not.toBeInTheDocument();
  });

  it('chave da agenda ligada: sem dias nem horário, e diz que vem da Agenda', () => {
    render(<EtapaRumo a={respostas()} set={vi.fn()} playbook={null} agendaLigada />);

    expect(screen.queryByRole('button', { name: 'Seg' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Das')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('até')).not.toBeInTheDocument();
    expect(screen.getByText(/Os dias e o horário de visita vêm da Agenda/)).toBeInTheDocument();
  });

  it('revisão com a chave ligada não mostra dias e horário do assistente', () => {
    render(<EtapaRevisao a={respostas()} playbook={null} irPara={vi.fn()} pipelines={[]} stages={[]} funis={[]} agendaLigada />);

    expect(screen.getByText('no horário de visita da Agenda')).toBeInTheDocument();
    expect(screen.queryByText(/das 09:00 às 18:00/)).not.toBeInTheDocument();
  });

  it('revisão com a chave desligada mostra dias e horário, como sempre', () => {
    render(<EtapaRevisao a={respostas()} playbook={null} irPara={vi.fn()} pipelines={[]} stages={[]} funis={[]} />);

    expect(screen.getByText(/das 09:00 às 18:00/)).toBeInTheDocument();
  });
});
