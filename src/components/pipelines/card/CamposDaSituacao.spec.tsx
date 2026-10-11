import { beforeAll, describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
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

// Raio-X de 10/10/2026: pro corretor o Responsável aparecia EM BRANCO — o nome
// saía da lista de pessoas, que o cargo dele não lê. Quem não troca vê texto;
// a própria pessoa é "Você"; o nome do outro vem do card.
describe('CampoResponsavel — quem não troca (corretor) vê só texto', () => {
  const semLista = { users: [], onTrocar: vi.fn(), podeTrocar: false, meuId: 'eu' };

  it('responsável é a própria pessoa: "Você", sem lista', () => {
    render(<CampoResponsavel {...semLista} responsavelId="eu" nomeDoResponsavel="Carla Corretora" />);

    expect(screen.getByText('Você')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Carla Corretora')).toBeNull();
  });

  it('responsável é outra pessoa: o nome que veio no card, mesmo sem a lista de pessoas', () => {
    render(<CampoResponsavel {...semLista} responsavelId="u9" nomeDoResponsavel="Bruno Silva" />);

    expect(screen.getByText('Bruno Silva')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('sem responsável: "Sem responsável"', () => {
    render(<CampoResponsavel {...semLista} responsavelId={null} />);

    expect(screen.getByText('Sem responsável')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('nome que não chegou nunca fica em branco', () => {
    render(<CampoResponsavel {...semLista} responsavelId="u9" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('CampoResponsavel — gestor troca pela lista', () => {
  // O Select do kit (Radix) usa APIs que o jsdom não tem.
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  });

  const pessoas = [{ id: 'eu', name: 'Gil Gestor' }, { id: 'u2', name: 'Bruno' }];

  it('o escolhido que é a própria pessoa aparece "Você"', () => {
    render(<CampoResponsavel users={pessoas} responsavelId="eu" onTrocar={vi.fn()} podeTrocar meuId="eu" />);

    const gatilho = screen.getByRole('combobox');
    expect(within(gatilho).getByText('Você')).toBeInTheDocument();
  });

  it('na lista, a própria pessoa é "Você" e os outros pelo nome', async () => {
    render(<CampoResponsavel users={pessoas} responsavelId="u2" onTrocar={vi.fn()} podeTrocar meuId="eu" />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByRole('option', { name: 'Você' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bruno' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Gil Gestor' })).toBeNull();
  });

  it('escolhido fora da lista (ainda carregando) usa o nome do card', () => {
    render(<CampoResponsavel users={[]} responsavelId="u9" onTrocar={vi.fn()} podeTrocar meuId="eu" nomeDoResponsavel="Bruno Silva" />);

    expect(within(screen.getByRole('combobox')).getByText('Bruno Silva')).toBeInTheDocument();
  });
});
