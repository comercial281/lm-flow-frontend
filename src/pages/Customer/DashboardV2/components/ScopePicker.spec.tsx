import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScopePicker } from './ScopePicker';

// "Toda a imobiliária" é decidido pelo SERVIDOR (available_modes: só
// administrador e suporte recebem `all`). A tela só mostra o que ele oferece.
const escopo = (modes: ('mine' | 'team' | 'all')[], locked = false) => ({
  mode: modes[0], locked, available_modes: modes, blocks: { media_spend: false, operations: false },
});

describe('ScopePicker', () => {
  it('sem `all` vindo do servidor, "Toda a imobiliária" não aparece', () => {
    render(<ScopePicker scope={escopo(['team', 'mine'])} onChange={vi.fn()} />);
    expect(screen.queryByText('Toda a imobiliária')).not.toBeInTheDocument();
    expect(screen.getByText('Minha equipe')).toBeInTheDocument();
  });

  it('o corretor travado não vê seletor nenhum', () => {
    const { container } = render(<ScopePicker scope={escopo(['mine'], true)} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('quando o servidor oferece, aparece', () => {
    render(<ScopePicker scope={escopo(['all', 'mine', 'team'])} onChange={vi.fn()} />);
    expect(screen.getByText('Toda a imobiliária')).toBeInTheDocument();
  });
});
