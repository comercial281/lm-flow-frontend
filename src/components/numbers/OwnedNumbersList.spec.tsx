import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OwnedNumbersList from './OwnedNumbersList';
import type { OwnedNumber } from '@/features/numbers/types';

// "Números de atendimento" (spec 2b): os números de que a pessoa é DONA, com
// telefone e conexão, o selo Principal em um, e "alterar em Canais". Quem tem
// mais de um escolhe o principal aqui.
const lista: OwnedNumber[] = [
  { inbox_id: 'i1', name: 'WhatsApp 1', phone: '+5511912341234', connection: 'connected', principal: true },
  { inbox_id: 'i2', name: 'WhatsApp 2', phone: '+5511900001111', connection: 'disconnected', principal: false },
];

function renderList(props: Partial<Parameters<typeof OwnedNumbersList>[0]> = {}) {
  return render(
    <MemoryRouter>
      <OwnedNumbersList numbers={lista} canChoosePrimary emptyText="vazio" {...props} />
    </MemoryRouter>,
  );
}

describe('OwnedNumbersList', () => {
  it('telefone de verdade, conexão, o selo Principal só no principal e o caminho para Canais', () => {
    renderList();

    expect(screen.getByText('(11) 91234-1234')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp 2 · desconectado')).toBeInTheDocument();
    expect(screen.getAllByText('Principal')).toHaveLength(1);
    const links = screen.getAllByRole('link', { name: 'alterar em Canais' });
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/channels/i1/settings', '/channels/i2/settings']);
  });

  it('escolher o principal chama quem cuida da troca', async () => {
    const onChoosePrimary = vi.fn();
    renderList({ onChoosePrimary });

    await userEvent.click(screen.getByRole('button', { name: 'Tornar principal' }));

    expect(onChoosePrimary).toHaveBeenCalledWith('i2');
  });

  it('sem permissão, ou com um número só, não oferece a troca', () => {
    const { unmount } = renderList({ canChoosePrimary: false, onChoosePrimary: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Tornar principal' })).not.toBeInTheDocument();
    unmount();

    renderList({ numbers: [lista[0]], onChoosePrimary: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Tornar principal' })).not.toBeInTheDocument();
  });

  it('sem número: o texto de vazio', () => {
    renderList({ numbers: [] });
    expect(screen.getByText('vazio')).toBeInTheDocument();
  });
});
