import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
import SecaoValores from './SecaoValores';
import SecaoTipologias from './SecaoTipologias';

const form = { title: '', transaction_type: 'sale', category_type: 'residential', property_type: 'house', status: 'active', stage: 'ready' } as PropertyFormData;

// Aplica a mudança (objeto ou função) sobre o formulário, como a página faz.
const aplicada = (setF: ReturnType<typeof vi.fn>, f: PropertyFormData, n = 0) => {
  const m = setF.mock.calls[n][0];
  return typeof m === 'function' ? m(f) : m;
};

describe('seções novas', () => {
  it('Valores do Leilão: ocupação e avaliação, venda sem asterisco', () => {
    const setF = vi.fn();
    render(<SecaoValores form={{ ...form, listing_kind: 'auction' }} setF={setF} editando={null} />);
    expect(screen.getByText('Ocupação')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor de avaliação (R$)')).toBeInTheDocument();
    expect(screen.queryByText('(R$) *')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Ocupado' }));
    expect(setF).toHaveBeenCalledWith({ occupancy: 'occupied' });
  });

  it('Valores do Leilão: mostra o valor de venda mesmo com finalidade de aluguel no formulário', () => {
    render(<SecaoValores form={{ ...form, transaction_type: 'rent', listing_kind: 'auction' }} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText(/Valor de venda/)).toBeInTheDocument();
  });

  it('Valores do Leilão: desconto ao vivo sob os dois valores', () => {
    const { rerender } = render(<SecaoValores form={{ ...form, listing_kind: 'auction', sale_price: 310000, appraisal_value: 1000000 }} setF={vi.fn()} editando={null} />);
    expect(screen.getByTestId('desconto-leilao')).toHaveTextContent('69% abaixo da avaliação');
    rerender(<SecaoValores form={{ ...form, listing_kind: 'auction', sale_price: 310000, appraisal_value: null }} setF={vi.fn()} editando={null} />);
    expect(screen.queryByTestId('desconto-leilao')).toBeNull();
    rerender(<SecaoValores form={{ ...form, listing_kind: 'resale', sale_price: 310000, appraisal_value: 1000000 }} setF={vi.fn()} editando={null} />);
    expect(screen.queryByTestId('desconto-leilao')).toBeNull();
  });

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

  it('revenda escolhe À venda e Para alugar (sem Temporada)', async () => {
    const setF = vi.fn();
    const { rerender } = render(<SecaoBasico form={{ ...form, listing_kind: 'resale', transaction_type: 'sale' }} setF={setF} editando={null} />);
    const grupo = screen.getByRole('group', { name: 'Finalidade' });
    expect(within(grupo).getAllByRole('checkbox').map(c => c.nextElementSibling?.textContent)).toEqual(['À venda', 'Para alugar']);
    expect(screen.queryByText('Temporada')).toBeNull();
    await userEvent.click(within(grupo).getByRole('checkbox', { name: 'Para alugar' }));
    expect(setF).toHaveBeenLastCalledWith({ transaction_type: 'sale_rent' });
    await userEvent.click(within(grupo).getByRole('checkbox', { name: 'À venda' }));
    expect(setF).toHaveBeenLastCalledWith({ transaction_type: '' });
    rerender(<SecaoBasico form={{ ...form, listing_kind: 'resale', transaction_type: '' }} setF={setF} editando={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Marque À venda, Para alugar ou os dois.');
  });

  it('empreendimento não mostra finalidade', () => {
    render(<SecaoBasico form={{ ...form, listing_kind: 'development' }} setF={vi.fn()} editando={null} />);
    expect(screen.queryByRole('group', { name: 'Finalidade' })).toBeNull();
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
  it('Tipologias: com preço nas plantas, o Valor de venda é o "a partir de" travado', () => {
    render(<SecaoTipologias form={{ ...form, listing_kind: 'development', sale_price: 244.63,
      typologies: [{ name: '2 dorms', sale_price: 267818.06 }, { name: '1 dorm', sale_price: 244633 }] }} setF={vi.fn()} editando={null} />);
    const campo = screen.getByLabelText('Valor de venda');
    expect(campo).toBeDisabled();
    expect(campo).toHaveValue('244.633');
    expect(screen.getByText(/A partir de: o menor preço das tipologias/)).toBeInTheDocument();
  });

  it('Tipologias: sem preço nas plantas, o Valor de venda é digitado', () => {
    render(<SecaoTipologias form={{ ...form, listing_kind: 'development', sale_price: 450000,
      typologies: [{ name: '2 dorms', bedrooms: 2 }] }} setF={vi.fn()} editando={null} />);
    const campo = screen.getByLabelText('Valor de venda');
    expect(campo).toBeEnabled();
    expect(campo).toHaveValue('450.000');
    expect(screen.queryByText(/A partir de: o menor preço das tipologias/)).toBeNull();
  });

  it('Sem vaga grava 0 e trava o campo; desmarcar volta ao vazio; imóvel com 0 abre marcado', async () => {
    const setF = vi.fn();
    const { rerender } = render(<SecaoComposicao form={{ ...form, listing_kind: 'resale', parking_spaces: null }} setF={setF} editando={null} />);
    expect(screen.getByLabelText('Vagas')).toBeEnabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sem vaga' }));
    expect(setF).toHaveBeenLastCalledWith({ parking_spaces: 0 });
    rerender(<SecaoComposicao form={{ ...form, listing_kind: 'resale', parking_spaces: 0 }} setF={setF} editando={null} />);
    expect(screen.getByRole('checkbox', { name: 'Sem vaga' })).toBeChecked();
    expect(screen.getByLabelText('Vagas')).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sem vaga' }));
    expect(setF).toHaveBeenLastCalledWith({ parking_spaces: null });
    rerender(<SecaoComposicao form={{ ...form, listing_kind: 'resale', parking_spaces: null }} setF={setF} editando={null} />);
    expect(screen.getByLabelText('Vagas')).toHaveValue(null);
    await userEvent.type(screen.getByLabelText('Vagas'), '2');
    expect(setF).toHaveBeenLastCalledWith({ parking_spaces: 2 });
  });

  it('Aceita permuta: Sim, Não, A conversar, Não informado', async () => {
    const setF = vi.fn();
    render(<SecaoDetalhesDaVenda form={{ ...form, listing_kind: 'resale', accepts_swap: 'sim' }} setF={setF} editando={null} />);
    const grupo = screen.getByRole('radiogroup', { name: 'Aceita permuta' });
    expect(within(grupo).getAllByRole('radio').map(r => r.textContent)).toEqual(['Sim', 'Não', 'A conversar', 'Não informado']);
    expect(within(grupo).getByRole('radio', { name: 'Sim' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(grupo).getByRole('radio', { name: 'A conversar' }));
    expect(setF).toHaveBeenLastCalledWith({ accepts_swap: 'a_conversar' });
    await userEvent.click(within(grupo).getByRole('radio', { name: 'Não informado' }));
    expect(setF).toHaveBeenLastCalledWith({ accepts_swap: null });
  });

  it('Fase da obra oferece "Fase não informada" e esconde a previsão de entrega nela', () => {
    const { rerender } = render(<SecaoObra form={{ ...form, listing_kind: 'development', stage: 'unknown' }} setF={vi.fn()} editando={null} />);
    expect(screen.getByRole('option', { name: 'Fase não informada' })).toBeInTheDocument();
    expect(screen.queryByText('Previsão de entrega')).toBeNull();
    rerender(<SecaoObra form={{ ...form, listing_kind: 'development', stage: 'launch' }} setF={vi.fn()} editando={null} />);
    expect(screen.getByText('Previsão de entrega')).toBeInTheDocument();
  });

  it('Digitar 0 no campo de vagas não trava; terreno não mostra Vagas', async () => {
    function Vivo({ inicial }: { inicial: Partial<PropertyFormData> }) {
      const [f, setFo] = useState({ ...form, listing_kind: 'resale', ...inicial } as PropertyFormData);
      return <SecaoComposicao form={f} setF={m => setFo(p => ({ ...p, ...(typeof m === 'function' ? m(p) : m) }))} editando={null} />;
    }
    const { unmount } = render(<Vivo inicial={{ parking_spaces: null }} />);
    await userEvent.type(screen.getByLabelText('Vagas'), '0');
    expect(screen.getByLabelText('Vagas')).toBeEnabled();
    unmount();
    render(<Vivo inicial={{ property_type: 'lot' }} />);
    expect(screen.queryByLabelText('Vagas')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Sem vaga' })).toBeNull();
  });

  it('temporada: desmarcar e remarcar Para alugar continua temporada', async () => {
    function Vivo() {
      const [t, setT] = useState('season');
      return <SecaoBasico form={{ ...form, listing_kind: 'resale', transaction_type: t }} setF={m => setT((m as { transaction_type: string }).transaction_type)} editando={null} />;
    }
    render(<Vivo />);
    const alugar = screen.getByRole('checkbox', { name: 'Para alugar' });
    await userEvent.click(alugar);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Para alugar' }));
    expect(screen.getByRole('checkbox', { name: 'Para alugar' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'À venda' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'À venda' }));
    // voltou a só aluguel: segue temporada (nada mudou para 'rent')
    expect(screen.getByRole('checkbox', { name: 'À venda' })).not.toBeChecked();
  });
});
