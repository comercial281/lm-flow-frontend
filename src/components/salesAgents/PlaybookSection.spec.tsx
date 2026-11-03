import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaybookSection from './PlaybookSection';

describe('PlaybookSection (Motor: só o que o servidor ainda lê)', () => {
  it('só tem a dor típica: sem reescrita de bloco, sem pontos-chave nem objeções', () => {
    render(<PlaybookSection playbook={{}} onSave={vi.fn()} />);
    expect(screen.getByLabelText('O que dói em quem procura vocês')).toBeInTheDocument();
    expect(screen.queryByText(/Reescrever/)).toBeNull();
    expect(screen.queryByText(/Pontos-chave/)).toBeNull();
    expect(screen.queryByText(/Objeção/)).toBeNull();
  });

  it('grava a dor sem apagar as outras chaves (caminhos da intenção, tipo de venda)', async () => {
    const onSave = vi.fn();
    const caminhos = [{ nome: 'Morar', como: 'x' }];
    render(<PlaybookSection playbook={{ vars: { caminhos_intencao: caminhos, tipo_venda: 'usado', lead_pronto: 'y' } }} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('O que dói em quem procura vocês'), 'aluguel caro');
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith({ playbook: { vars: { caminhos_intencao: caminhos, tipo_venda: 'usado', lead_pronto: 'y', dor_tipica: 'aluguel caro' } } });
  });

  it('apagar o texto tira a chave (volta ao padrão)', async () => {
    const onSave = vi.fn();
    render(<PlaybookSection playbook={{ vars: { dor_tipica: 'x' } }} onSave={onSave} />);
    await userEvent.clear(screen.getByLabelText('O que dói em quem procura vocês'));
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith({ playbook: {} });
  });
});
