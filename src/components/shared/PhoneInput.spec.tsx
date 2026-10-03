import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneInput } from './PhoneInput';

function Campo({ inicial = '', formato }: { inicial?: string; formato?: 'e164' | 'digits' }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <PhoneInput value={valor} onChange={setValor} valueFormat={formato} placeholder="tel" />
      <output data-testid="valor">{valor}</output>
    </>
  );
}

describe('PhoneInput', () => {
  it('no modo digits, digitar não ganha um 55 a mais no meio do caminho', async () => {
    render(<Campo formato="digits" />);
    await userEvent.type(screen.getByPlaceholderText('tel'), '11987654321');
    expect(screen.getByTestId('valor').textContent).toBe('5511987654321');
  });

  it('no modo e164 (padrão), devolve com +', async () => {
    render(<Campo />);
    await userEvent.type(screen.getByPlaceholderText('tel'), '11987654321');
    expect(screen.getByTestId('valor').textContent).toBe('+5511987654321');
  });

  it('não aceita letra', async () => {
    render(<Campo formato="digits" />);
    await userEvent.type(screen.getByPlaceholderText('tel'), 'abc11');
    expect(screen.getByTestId('valor').textContent).toBe('5511');
  });

  it('número salvo só com dígitos aparece formatado', () => {
    render(<Campo inicial="5511987654321" formato="digits" />);
    expect((screen.getByPlaceholderText('tel') as HTMLInputElement).value).toBe('+55 11 98765 4321');
  });

  it('número antigo só com DDD aparece como Brasil', () => {
    render(<Campo inicial="11987654321" formato="digits" />);
    expect((screen.getByPlaceholderText('tel') as HTMLInputElement).value).toBe('+55 11 98765 4321');
  });
});
