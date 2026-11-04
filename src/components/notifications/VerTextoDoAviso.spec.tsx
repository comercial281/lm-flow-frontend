import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import VerTextoDoAviso from './VerTextoDoAviso';

const TEXTO = '*Lead sem responsável*\n\nMaria Silva entrou no funil.\n\n👉 Abrir o lead: https://suaempresa.lmflow.com.br/...';

describe('VerTextoDoAviso', () => {
  it('aviso sem texto de exemplo não mostra o botão', () => {
    const { container } = render(<VerTextoDoAviso titulo="Automação" texto={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('abre a janela com o texto do WhatsApp, avisando que os dados são de exemplo', async () => {
    render(<VerTextoDoAviso titulo="Lead sem responsável" texto={TEXTO} />);

    await userEvent.click(screen.getByRole('button', { name: 'Ver texto' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Maria Silva entrou no funil.');
    expect(screen.getByRole('dialog')).toHaveTextContent('https://suaempresa.lmflow.com.br/...');
    expect(screen.getByText(/nome e o link são de exemplo/i)).toBeInTheDocument();
  });

  it('o *negrito* do WhatsApp aparece em negrito, sem os asteriscos', async () => {
    render(<VerTextoDoAviso titulo="Lead sem responsável" texto={TEXTO} />);

    await userEvent.click(screen.getByRole('button', { name: 'Ver texto' }));

    const negrito = screen.getAllByText('Lead sem responsável').find((el) => el.tagName === 'STRONG');
    expect(negrito).toBeDefined();
    expect(screen.getByRole('dialog').textContent).not.toContain('*');
  });

  it('o texto entra como texto, nunca como HTML', async () => {
    render(<VerTextoDoAviso titulo="Teste" texto={'<img src=x onerror=alert(1)> oi'} />);

    await userEvent.click(screen.getByRole('button', { name: 'Ver texto' }));

    expect(screen.getByRole('dialog').querySelector('img')).toBeNull();
    expect(screen.getByRole('dialog')).toHaveTextContent('<img src=x onerror=alert(1)> oi');
  });
});
