import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InboxAccessList, { autoAccessLabel } from './InboxAccessList';
import type { TeamAccessInbox } from '@/types/teamAccess';

/* A regressão que estes testes existem para impedir: a instância que o SISTEMA
   liberou aparecia com a mesma caixinha marcada da que o gestor liberou. Ele
   desmarcava, o backend recusava de propósito (senão o corretor perde acesso ao
   lead que é dele) e a caixinha voltava marcada sozinha, sem aviso. */

const inboxes: TeamAccessInbox[] = [
  { id: 'ib-1', name: 'Comercial', channel_type: 'Channel::Whatsapp' },
  { id: 'ib-2', name: 'Vendas', channel_type: 'Channel::Whatsapp' },
];

describe('InboxAccessList', () => {
  it('não oferece caixinha para o acesso que o gestor não controla', () => {
    render(
      <InboxAccessList
        inboxes={inboxes}
        grantedIds={['ib-1']}
        autoAccess={{ 'ib-2': { reason: 'leads', leads: 3 } }}
        onToggle={vi.fn()}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Uma caixinha por instância, e só a liberada de fato vem marcada.
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.filter(c => c.checked)).toHaveLength(1);
  });

  it('mostra o motivo do acesso automático em vez de deixar o gestor adivinhar', () => {
    render(
      <InboxAccessList
        inboxes={inboxes}
        grantedIds={['ib-1']}
        autoAccess={{ 'ib-2': { reason: 'leads', leads: 3 } }}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('Acesso automático')).toBeInTheDocument();
    expect(screen.getByText('é responsável por 3 leads daqui')).toBeInTheDocument();
  });

  it('não repete no bloco automático a instância que o gestor já assumiu', () => {
    render(
      <InboxAccessList
        inboxes={inboxes}
        grantedIds={['ib-2']}
        autoAccess={{ 'ib-2': { reason: 'leads', leads: 3 } }}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.queryByText('Acesso automático')).not.toBeInTheDocument();
  });

  it('avisa que Administrador alcança tudo, sem oferecer caixinha nenhuma', () => {
    render(
      <InboxAccessList inboxes={inboxes} grantedIds={[]} autoAccess={{}} seesAll onToggle={vi.fn()} />,
    );

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText(/todas as instâncias/i)).toBeInTheDocument();
  });
});

describe('autoAccessLabel', () => {
  it('concorda o singular do contador de leads', () => {
    expect(autoAccessLabel({ reason: 'leads', leads: 1 })).toBe('é responsável por 1 lead daqui');
    expect(autoAccessLabel({ reason: 'leads', leads: 2 })).toBe('é responsável por 2 leads daqui');
  });

  it('explica os motivos que não são contagem de lead', () => {
    expect(autoAccessLabel({ reason: 'roleta', leads: 0 })).toMatch(/roleta/);
    expect(autoAccessLabel({ reason: 'lead_sem_canal', leads: 0 })).toMatch(/não entrou por número/);
  });
});
