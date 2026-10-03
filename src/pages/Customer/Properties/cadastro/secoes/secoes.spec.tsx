import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropertyFormData } from '@/services/properties/propertiesService';
import SecaoDetalhesDaVenda from './SecaoDetalhesDaVenda';
import SecaoCaracteristicas from './SecaoCaracteristicas';
import SecaoConstrutora from './SecaoConstrutora';
import SecaoBasico from './SecaoBasico';
import SecaoComposicao from './SecaoComposicao';
import SecaoDadosInternos from './SecaoDadosInternos';
import SecaoComissao from './SecaoComissao';
import SecaoObra from './SecaoObra';

const form = { title: '', transaction_type: 'sale', category_type: 'residential', property_type: 'house', status: 'active', stage: 'ready' } as PropertyFormData;

// Aplica a mudança (objeto ou função) sobre o formulário, como a página faz.
const aplicada = (setF: ReturnType<typeof vi.fn>, f: PropertyFormData, n = 0) => {
  const m = setF.mock.calls[n][0];
  return typeof m === 'function' ? m(f) : m;
};

describe('seções novas', () => {
  it('Sim/Não/Não informado grava booleano ou nulo', async () => {
    const setF = vi.fn();
    render(<SecaoDetalhesDaVenda form={{ ...form, listing_kind: 'resale', accepts_fgts: true }} setF={setF} editando={null} />);
    const fgts = screen.getByRole('radiogroup', { name: 'Aceita FGTS' });
    await userEvent.click(within(fgts).getByRole('radio', { name: 'Não informado' }));
    expect(setF).toHaveBeenCalledWith({ accepts_fgts: null });
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Minha Casa Minha Vida' })).getByRole('radio', { name: 'Sim' }));
    expect(setF).toHaveBeenLastCalledWith({ mcmv: true });
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Aceita financiamento' })).getByRole('radio', { name: 'Não' }));
    expect(setF).toHaveBeenLastCalledWith({ accepts_financing: false });
    expect(screen.getByText('Exclusividade')).toBeInTheDocument();
  });

  it('empreendimento não mostra Exclusividade', () => {
    render(<SecaoDetalhesDaVenda form={{ ...form, listing_kind: 'development' }} setF={vi.fn()} editando={null} />);
    expect(screen.queryByText('Exclusividade')).toBeNull();
  });

  it('empreendimento: características só do condomínio; slug fora da lista sobrevive', async () => {
    const setF = vi.fn();
    const f = { ...form, listing_kind: 'development', features: ['agua'], condo_features: [] } as PropertyFormData;
    render(<SecaoCaracteristicas form={f} setF={setF} editando={null} />);
    expect(screen.queryByText('Piscina privativa')).toBeNull();
    expect(screen.getByText('Lazer e condomínio do empreendimento')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Academia' }));
    expect(aplicada(setF, f)).toEqual({ condo_features: ['academia'] });
  });

  it('revenda: marcar característica mantém slug antigo fora das opções', async () => {
    const setF = vi.fn();
    const f = { ...form, listing_kind: 'resale', features: ['agua'], condo_features: [] } as PropertyFormData;
    render(<SecaoCaracteristicas form={f} setF={setF} editando={null} />);
    expect(screen.getByText('Do imóvel')).toBeInTheDocument();
    expect(screen.getByText('Do condomínio')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Varanda' }));
    expect(aplicada(setF, f)).toEqual({ features: ['agua', 'varanda'] });
  });

  it('construtora grava dentro de builder sem perder o resto', async () => {
    const setF = vi.fn();
    render(<SecaoConstrutora form={{ ...form, listing_kind: 'development', builder: { cnpj: '1' } }} setF={setF} editando={null} />);
    await userEvent.type(screen.getByLabelText('Nome da construtora'), 'X');
    expect(setF).toHaveBeenLastCalledWith({ builder: { cnpj: '1', name: 'X' } });
  });

  it('revenda escolhe finalidade em pílulas', async () => {
    const setF = vi.fn();
    render(<SecaoBasico form={{ ...form, listing_kind: 'resale' }} setF={setF} editando={null} />);
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Finalidade' })).getByRole('radio', { name: 'Locação' }));
    expect(setF).toHaveBeenCalledWith({ transaction_type: 'rent' });
  });

  it('empreendimento não mostra finalidade', () => {
    render(<SecaoBasico form={{ ...form, listing_kind: 'development' }} setF={vi.fn()} editando={null} />);
    expect(screen.queryByRole('radiogroup', { name: 'Finalidade' })).toBeNull();
  });

  it('obra: inteiros, vazio vira nulo', async () => {
    const setF = vi.fn();
    render(<SecaoObra form={{ ...form, listing_kind: 'development', towers: 2 }} setF={setF} editando={null} />);
    await userEvent.type(screen.getByLabelText('Total de unidades'), '8');
    expect(setF).toHaveBeenLastCalledWith({ total_units: 8 });
    await userEvent.clear(screen.getByLabelText('Torres'));
    expect(setF).toHaveBeenLastCalledWith({ towers: null });
  });

  it('ano de construção: fora do intervalo não grava e mostra erro', async () => {
    const setF = vi.fn();
    render(<SecaoComposicao form={{ ...form, listing_kind: 'resale' }} setF={setF} editando={null} />);
    const campo = screen.getByLabelText('Ano de construção');
    await userEvent.type(campo, '1700');
    expect(setF).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um ano entre 1800');
    await userEvent.clear(campo);
    await userEvent.type(campo, '2015');
    expect(setF).toHaveBeenLastCalledWith({ construction_year: 2015 });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dados internos: aviso, máscara de reais guarda só dígitos', async () => {
    const setF = vi.fn();
    render(<SecaoDadosInternos form={{ ...form, listing_kind: 'resale', internal_info: { notary: 'C1' } }} setF={setF} editando={null} />);
    expect(screen.getByText('Só a sua equipe vê. Nada daqui vai para site, portal ou IA.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Valor de avaliação (R$)'), '4');
    expect(setF).toHaveBeenLastCalledWith({ internal_info: { notary: 'C1', appraised_value: '4' } });
    await userEvent.click(screen.getByLabelText('Tem placa'));
    expect(setF).toHaveBeenLastCalledWith({ on_sign: true });
  });

  it('dados internos mostram o valor com milhar', () => {
    render(<SecaoDadosInternos form={{ ...form, listing_kind: 'resale', internal_info: { appraised_value: '450000' } }} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText('Valor de avaliação (R$)')).toHaveValue('450.000');
  });

  it('comissão grava dentro de commission', async () => {
    const setF = vi.fn();
    render(<SecaoComissao form={{ ...form, commission: { notes: 'n' } }} setF={setF} editando={null} />);
    await userEvent.type(screen.getByLabelText('Percentual'), '5');
    expect(setF).toHaveBeenLastCalledWith({ commission: { notes: 'n', percent: '5' } });
  });
});
