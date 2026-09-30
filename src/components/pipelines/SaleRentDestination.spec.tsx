import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaleRentDestination from './SaleRentDestination';
import { EMPTY_DESTINATION, type LeadDestinationValue } from './LeadDestinationFields';
import type { LeadDestinationOptions } from './useLeadDestinationOptions';

const mocks = vi.hoisted(() => ({ getPipelineStages: vi.fn() }));

vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelineStages: (...a: unknown[]) => mocks.getPipelineStages(...a) },
}));

const options: LeadDestinationOptions = {
  pipelines: [{ id: 'pipe-1', label: 'Vendas' }, { id: 'pipe-2', label: 'Locação' }],
  roletas: [{ id: 'rol-1', name: 'Roleta principal', is_active: true } as never],
  users: [{ id: 'u-1', name: 'Ana' } as never],
  labels: [{ id: 'lab-1', label: 'quente' }],
};

function Harness({ showRent = true, showLabel = false }: { showRent?: boolean; showLabel?: boolean }) {
  const [sale, setSale] = useState<LeadDestinationValue>({ ...EMPTY_DESTINATION, pipeline_id: 'pipe-1' });
  const [rent, setRent] = useState<LeadDestinationValue>(EMPTY_DESTINATION);
  const [same, setSame] = useState(true);
  return (
    <>
      <SaleRentDestination
        sale={sale} rent={rent} rentSameAsSale={same}
        onSale={p => setSale(v => ({ ...v, ...p }))}
        onRent={p => setRent(v => ({ ...v, ...p }))}
        onRentSameAsSale={setSame}
        options={options} showRent={showRent} showLabel={showLabel}
      />
      <output data-testid="estado">{JSON.stringify({ sale, rent, same })}</output>
    </>
  );
}

const estado = () => JSON.parse(screen.getByTestId('estado').textContent || '{}');

describe('SaleRentDestination', () => {
  beforeEach(() => {
    mocks.getPipelineStages.mockImplementation(async (pid: string) => ({
      data: pid === 'pipe-2' ? [{ id: 'st-9', name: 'Entrada' }] : [{ id: 'st-1', name: 'Novo' }],
    }));
  });

  it('servidor antigo (sem locação): um destino só, sem abas', () => {
    render(<Harness showRent={false} />);

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Funil' })).toHaveValue('pipe-1');
  });

  it('abre na Venda; a Locação começa em "Mesmo destino da venda", sem seletores', async () => {
    const usuario = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole('tab', { name: 'Venda' })).toHaveAttribute('aria-selected', 'true');
    await usuario.click(screen.getByRole('tab', { name: 'Locação' }));

    expect(screen.getByRole('checkbox', { name: 'Mesmo destino da venda' })).toBeChecked();
    expect(screen.queryByRole('combobox', { name: 'Funil' })).toBeNull();
  });

  it('desligar "Mesmo destino da venda" abre o destino de locação, que é só dele', async () => {
    const usuario = userEvent.setup();
    render(<Harness />);
    await usuario.click(screen.getByRole('tab', { name: 'Locação' }));

    await usuario.click(screen.getByRole('checkbox', { name: 'Mesmo destino da venda' }));
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Funil' }), 'pipe-2');
    await usuario.selectOptions(await screen.findByRole('combobox', { name: 'Coluna' }), 'st-9');
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Roleta' }), 'rol-1');

    await waitFor(() => expect(estado().rent).toMatchObject({ pipeline_id: 'pipe-2', stage_id: 'st-9', roleta_config_id: 'rol-1' }));
    expect(estado().same).toBe(false);
    expect(estado().sale.pipeline_id).toBe('pipe-1');
  });

  it('etiqueta só aparece quando pedida (site)', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole('combobox', { name: 'Etiqueta' })).toBeNull();
    unmount();

    render(<Harness showLabel />);
    expect(screen.getByRole('combobox', { name: 'Etiqueta' })).toBeInTheDocument();
  });
});
