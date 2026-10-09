import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PeopleList from './PeopleList';
import type { MemberNumber, TeamAccessMember } from '@/types/teamAccess';

const num = (over: Partial<MemberNumber> = {}): MemberNumber => ({
  inbox_id: '1', name: 'Comercial', phone: null, connection: 'connected', principal: true, never_connected: false, owner: false, ...over,
});
const pessoa = (over: Partial<TeamAccessMember> = {}): TeamAccessMember => ({
  id: '1', name: 'Ana Souza', email: 'a@x.com', whatsapp_number: '11940871974', confirmed: true, availability: 1,
  role: { key: 'agent', name: 'Corretor', chave_role: 'agent' },
  sees_all_inboxes: false, granted_inbox_ids: [], auto_inbox_ids: [], auto_access: {},
  all_numbers: [num({ owner: true })], last_seen_at: new Date(2026, 9, 9, 10, 40).toISOString(), ...over,
});

const agora = new Date(2026, 9, 9, 12, 0);
const EQUIPE = [
  pessoa(),
  pessoa({ id: '2', name: 'Bruno Lima', whatsapp_number: null, all_numbers: [], last_seen_at: null }),
  pessoa({ id: '3', name: 'Carla Dias', sees_all_inboxes: true, all_numbers: [], role: { key: 'admin', name: 'Administrador', chave_role: 'admin' } }),
  pessoa({ id: '4', name: 'Davi Reis', all_numbers: [num({ name: 'Plantão', connection: 'disconnected' }), num({ inbox_id: '9', name: 'Novo', never_connected: true, connection: null })] }),
];

function abrir(over: Partial<React.ComponentProps<typeof PeopleList>> = {}) {
  const onOpen = vi.fn();
  const onCreateNumber = vi.fn();
  render(<PeopleList members={EQUIPE} canCreateNumber onOpen={onOpen} onCreateNumber={onCreateNumber} now={agora} {...over} />);
  return { onOpen, onCreateNumber };
}

describe('PeopleList', () => {
  it('mostra nome, celular formatado, cargo e acesso', () => {
    abrir();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getAllByText('(11) 94087-1974').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Corretor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Entrou hoje, 10:40').length).toBeGreaterThan(0);
  });

  it('sem celular, avisa', () => {
    abrir();
    expect(screen.getByText('Sem celular cadastrado')).toBeInTheDocument();
  });

  it('chips pelo nome do número, com estrela para o dono e situação', () => {
    abrir();
    // só a Ana é dona; os dois números do Davi foram só liberados
    expect(screen.getAllByLabelText('dono do número')).toHaveLength(1);
    expect(screen.getByText('Plantão').closest('span[title]')).toHaveAttribute('title', 'Plantão · Desconectado');
    expect(screen.getByText('Novo').closest('span[title]')).toHaveAttribute('title', 'Novo · Esperando conectar');
  });

  it('administrador mostra "Vê todos os números"', () => {
    abrir();
    expect(screen.getByText('Vê todos os números')).toBeInTheDocument();
  });

  it('sem número mostra "Nenhum número" e o atalho Criar número', async () => {
    const { onCreateNumber, onOpen } = abrir();
    expect(screen.getByText('Nenhum número')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Criar número para Bruno Lima' }));
    expect(onCreateNumber).toHaveBeenCalledWith(EQUIPE[1]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('pessoa em que quem vê não pode mexer: o atalho Criar número some', () => {
    abrir({ canActOn: () => false });
    expect(screen.getByText('Nenhum número')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Criar número/ })).toBeNull();
  });

  it('sem permissão de criar número, o atalho some', () => {
    abrir({ canCreateNumber: false });
    expect(screen.getByText('Nenhum número')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Criar número/ })).toBeNull();
  });

  it('a linha inteira é um botão que abre a pessoa', async () => {
    const { onOpen } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Davi Reis' }));
    expect(onOpen).toHaveBeenCalledWith(EQUIPE[3]);
  });

  it('abre pelo teclado', async () => {
    const { onOpen } = abrir();
    screen.getByRole('button', { name: 'Abrir Ana Souza' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith(EQUIPE[0]);
  });

  it('filtros com contagem e que filtram', async () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Todas · 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sem número · 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Número desconectado · 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ainda não entrou · 1' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Número desconectado · 1' }));
    const linhas = screen.getAllByTestId('person-row');
    expect(linhas).toHaveLength(1);
    expect(within(linhas[0]).getByText('Davi Reis')).toBeInTheDocument();
  });

  it('busca por nome e por dígitos do celular', async () => {
    abrir();
    await userEvent.type(screen.getByLabelText('Buscar pessoa'), '94087');
    expect(screen.getAllByTestId('person-row')).toHaveLength(3); // todos com esse celular (Bruno não tem)
    await userEvent.clear(screen.getByLabelText('Buscar pessoa'));
    await userEvent.type(screen.getByLabelText('Buscar pessoa'), 'bruno');
    expect(screen.getAllByTestId('person-row')).toHaveLength(1);
  });

  it('nenhum resultado diz isso', async () => {
    abrir();
    await userEvent.type(screen.getByLabelText('Buscar pessoa'), 'zzz');
    expect(screen.getByText('Nenhuma pessoa encontrada.')).toBeInTheDocument();
  });

  it('tem a legenda', () => {
    abrir();
    const legenda = screen.getByRole('list', { name: 'Legenda' });
    for (const t of ['Conectado', 'Esperando conectar', 'Desconectado', 'Dono do número']) {
      expect(within(legenda).getByText(t)).toBeInTheDocument();
    }
  });

  // A linha é coberta por um botão e o resto ignora o ponteiro: o `title` do chip
  // nunca aparecia. Número com problema diz a situação escrita, sem passar o mouse.
  it('chip com problema escreve a situação; o conectado só tem a bolinha', () => {
    abrir();
    const plantao = screen.getByText('Plantão').closest('span[title]') as HTMLElement;
    expect(within(plantao).getByText('desconectado')).not.toHaveClass('sr-only');
    const novo = screen.getByText('Novo').closest('span[title]') as HTMLElement;
    expect(within(novo).getByText('esperando conectar')).not.toHaveClass('sr-only');
    const comercial = screen.getAllByText('Comercial')[0].closest('span[title]') as HTMLElement;
    expect(within(comercial).getByText(', Conectado')).toHaveClass('sr-only');
  });

  // Inativo esmaece o rosto e os números, não o nome nem o "Inativo": é o que o
  // gestor precisa ler para saber quem está fora.
  it('pessoa inativa: nome e selo legíveis, avatar e números esmaecidos', () => {
    abrir({ members: [pessoa({ id: '7', name: 'Eva Fora', deactivated: true })] });
    const linha = screen.getByTestId('person-row');
    expect(linha).not.toHaveClass('opacity-60');
    expect(within(linha).getByText('Eva Fora').closest('.opacity-60')).toBeNull();
    expect(within(linha).getByText('Inativo').closest('.opacity-60')).toBeNull();
    expect(within(linha).getByText('EF').closest('.opacity-60')).not.toBeNull();
    expect(within(linha).getByText('Comercial').closest('.opacity-60')).not.toBeNull();
  });
});
