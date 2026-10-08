import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CampoEtapa, CampoResponsavel } from './CamposDaSituacao';
import type { PipelineStage } from '@/types/analytics';

// E0 do funil (spec §7, item da call): nome longo de etapa ou de corretor
// passava da caixa e empurrava a coluna da janela do card. Agora corta com
// reticências, e o nome inteiro aparece ao passar o mouse (title).

const ETAPA_LONGA = 'Agendou visita no plantão do empreendimento Jardim das Acácias Fase 2';
const CORRETOR_LONGO = 'Maria Aparecida dos Santos Oliveira de Albuquerque Cavalcanti';
const etapa = (id: string, name: string): PipelineStage => ({ id, name, color: 'purple', position: 0 });

describe('CampoEtapa', () => {
  it('nome longo corta com reticências; a caixa não cresce; o nome inteiro vai no title', () => {
    render(<CampoEtapa stages={[etapa('s1', ETAPA_LONGA), etapa('s2', 'Novo')]} etapaId="s1" onMover={vi.fn()} />);

    expect(screen.getByText('Etapa')).toBeInTheDocument();
    const gatilho = screen.getByTitle(ETAPA_LONGA);
    expect(gatilho).toHaveClass('w-full', 'min-w-0', 'overflow-hidden');
    expect(within(gatilho).getByText(ETAPA_LONGA)).toHaveClass('truncate');
  });

  it('sem etapa escolhida mostra o convite', () => {
    render(<CampoEtapa stages={[etapa('s1', 'Novo')]} etapaId={null} onMover={vi.fn()} />);
    expect(screen.getByText('Escolha a etapa')).toBeInTheDocument();
  });
});

describe('CampoResponsavel', () => {
  it('nome longo corta com reticências; a caixa não cresce; o nome inteiro vai no title', () => {
    render(<CampoResponsavel users={[{ id: 'u1', name: CORRETOR_LONGO }]} responsavelId="u1" onTrocar={vi.fn()} />);

    expect(screen.getByText('Responsável')).toBeInTheDocument();
    const gatilho = screen.getByTitle(CORRETOR_LONGO);
    expect(gatilho).toHaveClass('w-full', 'min-w-0', 'overflow-hidden');
    expect(within(gatilho).getByText(CORRETOR_LONGO)).toHaveClass('truncate');
  });

  it('sem responsável mostra "Sem responsável"', () => {
    render(<CampoResponsavel users={[{ id: 'u1', name: 'Ana' }]} responsavelId={null} onTrocar={vi.fn()} />);
    expect(within(screen.getByTitle('Sem responsável')).getByText('Sem responsável')).toHaveClass('truncate');
  });
});
