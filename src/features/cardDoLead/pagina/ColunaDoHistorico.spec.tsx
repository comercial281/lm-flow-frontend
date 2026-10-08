import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ColunaDoHistorico from './ColunaDoHistorico';

vi.mock('../blocos/BlocoHistorico', () => ({ default: () => <div data-testid="historico" /> }));
vi.mock('../blocos/BlocoObservacoes', () => ({ default: (p: { contactId: string | null }) => <div data-testid="observacoes">{p.contactId}</div> }));

const card = (notas: boolean) => ({
  contato: { id: 'c1' },
  historico: { eventos: [], carregando: false, recarregar: vi.fn() },
  recursos: { notas, imoveis: true, agendarEnvio: true },
}) as never;

describe('ColunaDoHistorico (até a Parte 5)', () => {
  it('Histórico e Observações separados, como na janela', () => {
    render(<ColunaDoHistorico card={card(true)} />);
    expect(screen.getByTestId('historico')).toBeInTheDocument();
    expect(screen.getByTestId('observacoes')).toHaveTextContent('c1');
  });

  it('sem o recurso de notas, só o Histórico', () => {
    render(<ColunaDoHistorico card={card(false)} />);
    expect(screen.queryByTestId('observacoes')).toBeNull();
  });
});
