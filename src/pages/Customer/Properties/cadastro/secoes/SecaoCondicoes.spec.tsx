import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropertyFormData } from '@/services/properties/propertiesService';
import { CamposTravadosContext } from '@/features/properties/cadastro/travasDoSite';
import SecaoCondicoes from './SecaoCondicoes';

const base = { title: 'Residencial Teste', transaction_type: 'sale', category_type: 'residential', property_type: 'apartment', status: 'active', stage: 'ready' } as PropertyFormData;

// Estado de verdade: a seção grava no formulário e relê dele, como na página.
function Montado({ inicial = {}, travados = [] }: { inicial?: Partial<PropertyFormData>; travados?: string[] }) {
  const [f, setF] = useState<PropertyFormData>({ ...base, ...inicial });
  return (
    <CamposTravadosContext.Provider value={travados}>
      <SecaoCondicoes form={f} setF={m => setF(prev => ({ ...prev, ...(typeof m === 'function' ? m(prev) : m) }))} editando={null} />
      <output data-testid="estado">{JSON.stringify(f)}</output>
    </CamposTravadosContext.Provider>
  );
}
const estado = () => JSON.parse(screen.getByTestId('estado').textContent!) as PropertyFormData;

describe('SecaoCondicoes', () => {
  it('entrada, parcela e renda em dinheiro (máscara da casa)', async () => {
    render(<Montado />);
    await userEvent.type(screen.getByLabelText('Entrada a partir de (R$)'), '12.500');
    await userEvent.type(screen.getByLabelText('Parcela a partir de (R$)'), '890,50');
    await userEvent.type(screen.getByLabelText('Renda mínima (R$)'), '3500');
    expect(estado()).toMatchObject({ down_payment_from: 12500, installment_from: 890.5, min_income: 3500 });
    expect(screen.getByLabelText('Entrada a partir de (R$)')).toHaveValue('12.500');
  });

  it('fluxo de pagamento para em 300 letras', async () => {
    render(<Montado />);
    const campo = screen.getByLabelText('Fluxo de pagamento');
    await userEvent.click(campo);
    await userEvent.paste('a'.repeat(350));
    expect(estado().payment_terms).toHaveLength(300);
  });

  it('Pra quem serve usa a frase "deste imóvel"', async () => {
    render(<Montado />);
    expect(screen.getByTestId('frase-pra-quem-serve')).toHaveTextContent('Sem nada marcado: vale o padrão da IA.');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Investimento' }));
    expect(estado().serves_intents).toEqual(['investimento']);
    expect(screen.getByTestId('frase-pra-quem-serve')).toHaveTextContent('Todo lead deste imóvel é tratado como Investimento.');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Investimento' }));
    expect(estado().serves_intents).toEqual([]);
  });

  it('nunca prometer: até 6 linhas de 150 letras', async () => {
    render(<Montado inicial={{ never_promise: ['a', 'b', 'c', 'd', 'e'] }} />);
    const campo = screen.getByLabelText('Nova linha de nunca prometer');
    expect(campo).toHaveAttribute('maxlength', '150');
    await userEvent.type(campo, 'f{Enter}');
    expect(estado().never_promise).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(screen.queryByLabelText('Nova linha de nunca prometer')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar: a' }));
    expect(estado().never_promise).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(screen.getByLabelText('Nova linha de nunca prometer')).toBeInTheDocument();
  });

  it('objeções: até 10, editáveis e removíveis', async () => {
    const dez = Array.from({ length: 9 }, (_, i) => ({ objecao: `O${i}`, resposta: `R${i}` }));
    render(<Montado inicial={{ objections: dez }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar objeção' }));
    expect(estado().objections).toHaveLength(10);
    expect(screen.queryByRole('button', { name: 'Adicionar objeção' })).toBeNull();
    await userEvent.type(screen.getByLabelText('Objeção 10'), 'Caro');
    await userEvent.type(screen.getByLabelText('Resposta da objeção 10'), 'Dá pra simular');
    expect(estado().objections![9]).toEqual({ objecao: 'Caro', resposta: 'Dá pra simular' });
    await userEvent.click(screen.getByRole('button', { name: 'Tirar objeção 1' }));
    expect(estado().objections).toHaveLength(9);
  });

  it('fato de urgência sem data mostra a frase do servidor; com data, some', async () => {
    render(<Montado />);
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.type(screen.getByLabelText('O fato'), 'Tabela promocional');
    expect(screen.getByRole('alert')).toHaveTextContent('Fato de urgência precisa da data em que deixa de valer.');
    await userEvent.type(screen.getByLabelText('Vale até'), '2027-01-31');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/A IA usa até 31\/01\/2027/)).toBeInTheDocument();
  });

  it('campo que vem do site segue travado', () => {
    render(<Montado travados={['down_payment_from', 'urgency_fact']} />);
    expect(screen.getByLabelText('Entrada a partir de (R$)')).toBeDisabled();
    expect(screen.getByLabelText('O fato')).toBeDisabled();
    expect(screen.getByLabelText('Parcela a partir de (R$)')).toBeEnabled();
  });
});
