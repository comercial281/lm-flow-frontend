import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaleRentDestination from './SaleRentDestination';
import { EMPTY_DESTINATION, type LeadDestinationValue } from './LeadDestinationFields';
import type { LeadDestinationOptions } from './useLeadDestinationOptions';
import { Secoes } from '@/components/base/Secao';

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
      <Secoes>
        <SaleRentDestination
          sale={sale} rent={rent} rentSameAsSale={same}
          onSale={p => setSale(v => ({ ...v, ...p }))}
          onRent={p => setRent(v => ({ ...v, ...p }))}
          onRentSameAsSale={setSame}
          options={options} showRent={showRent} showLabel={showLabel}
          titulos={{ unico: 'Destino do lead', venda: 'Destino do lead de venda', locacao: 'Destino do lead de locação' }}
        />
      </Secoes>
      <output data-testid="estado">{JSON.stringify({ sale, rent, same })}</output>
    </>
  );
}

const estado = () => JSON.parse(screen.getByTestId('estado').textContent || '{}');
/** A seção pelo título: Venda e Locação são duas seções, cada uma com o seu Funil. */
const secao = (titulo: string) => screen.getByRole('heading', { name: titulo }).closest('section') as HTMLElement;

describe('SaleRentDestination', () => {
  beforeEach(() => {
    mocks.getPipelineStages.mockImplementation(async (pid: string) => ({
      data: pid === 'pipe-2' ? [{ id: 'st-9', name: 'Entrada' }] : [{ id: 'st-1', name: 'Novo' }],
    }));
  });

  it('servidor antigo (sem locação): uma seção só, com o título único', () => {
    render(<Harness showRent={false} />);

    expect(screen.getByRole('heading', { name: 'Destino do lead' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Destino do lead de locação' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Funil' })).toHaveValue('pipe-1');
  });

  it('Venda e Locação são duas seções, nunca abas; a Locação começa em "Mesmo destino da venda"', () => {
    render(<Harness />);

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(within(secao('Destino do lead de venda')).getByRole('combobox', { name: 'Funil' })).toHaveValue('pipe-1');
    const locacao = secao('Destino do lead de locação');
    expect(within(locacao).getByRole('checkbox', { name: 'Mesmo destino da venda' })).toBeChecked();
    expect(within(locacao).queryByRole('combobox', { name: 'Funil' })).toBeNull();
  });

  it('desligar "Mesmo destino da venda" abre o destino de locação, que é só dele', async () => {
    const usuario = userEvent.setup();
    render(<Harness />);
    const locacao = secao('Destino do lead de locação');

    await usuario.click(within(locacao).getByRole('checkbox', { name: 'Mesmo destino da venda' }));
    await usuario.selectOptions(within(locacao).getByRole('combobox', { name: 'Funil' }), 'pipe-2');
    await usuario.selectOptions(await within(locacao).findByRole('combobox', { name: 'Coluna' }), 'st-9');
    await usuario.selectOptions(within(locacao).getByRole('combobox', { name: 'Quem assume o lead' }), 'roleta:rol-1');

    await waitFor(() => expect(estado().rent).toMatchObject({ pipeline_id: 'pipe-2', stage_id: 'st-9', roleta_config_id: 'rol-1' }));
    expect(estado().same).toBe(false);
    expect(estado().sale.pipeline_id).toBe('pipe-1');
  });

  it('trocar o Funil limpa a Coluna na hora, antes da resposta do novo funil chegar', async () => {
    const usuario = userEvent.setup();
    render(<Harness />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Novo' })).toBeInTheDocument());

    mocks.getPipelineStages.mockImplementationOnce(() => new Promise(() => {}));
    await usuario.selectOptions(within(secao('Destino do lead de venda')).getByRole('combobox', { name: 'Funil' }), 'pipe-2');

    expect(screen.queryByRole('option', { name: 'Novo' })).toBeNull();
  });

  it('Roleta e Responsável viraram uma lista só: escolher um limpa o outro', async () => {
    const usuario = userEvent.setup();
    render(<Harness />);
    const venda = secao('Destino do lead de venda');
    const quem = within(venda).getByRole('combobox', { name: 'Quem assume o lead' });
    expect(within(venda).getByRole('group', { name: 'Corretores' })).toBeInTheDocument();
    expect(within(venda).getByRole('group', { name: 'Roleta' })).toBeInTheDocument();

    await usuario.selectOptions(quem, 'corretor:u-1');
    expect(estado().sale).toMatchObject({ default_assignee_id: 'u-1', roleta_config_id: '' });
    await usuario.selectOptions(quem, 'roleta:rol-1');
    expect(estado().sale).toMatchObject({ default_assignee_id: '', roleta_config_id: 'rol-1' });
    await usuario.selectOptions(quem, '');
    expect(estado().sale).toMatchObject({ default_assignee_id: '', roleta_config_id: '' });
  });

  it('etiqueta só aparece quando pedida (site)', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole('combobox', { name: 'Etiqueta' })).toBeNull();
    unmount();

    render(<Harness showLabel />);
    expect(screen.getByRole('combobox', { name: 'Etiqueta' })).toBeInTheDocument();
  });
});
