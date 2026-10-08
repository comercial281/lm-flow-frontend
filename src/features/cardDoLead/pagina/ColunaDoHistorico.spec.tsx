// src/features/cardDoLead/pagina/ColunaDoHistorico.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ColunaDoHistorico from './ColunaDoHistorico';

const historico = vi.hoisted(() => vi.fn());
vi.mock('../historico/HistoricoDoLead', () => ({
  default: (p: Record<string, unknown>) => {
    historico(p);
    return <div data-testid="historico" />;
  },
}));

const card = (notas: boolean) => ({
  contato: { id: 'c1' },
  historico: { versao: '0|s1|open|u1', recarregar: vi.fn() },
  recursos: { notas, imoveis: true, agendarEnvio: true },
}) as never;

beforeEach(() => historico.mockReset());

describe('ColunaDoHistorico (página do card, E5)', () => {
  it('o Histórico inteiro: modo completo, do contato, com o funil e a chave de recarga', () => {
    render(<ColunaDoHistorico card={card(true)} funilAtual="Leads (Marketing)" />);

    expect(screen.getByTestId('historico')).toBeInTheDocument();
    expect(historico).toHaveBeenLastCalledWith(expect.objectContaining({
      modo: 'completo',
      contactId: 'c1',
      funilAtual: 'Leads (Marketing)',
      versao: '0|s1|open|u1',
      comObservacoes: true,
    }));
  });

  it('sem o recurso de notas: sem a caixa de escrever e sem o filtro Observações', () => {
    render(<ColunaDoHistorico card={card(false)} />);
    expect(historico).toHaveBeenLastCalledWith(expect.objectContaining({ comObservacoes: false, funilAtual: null }));
  });
});
