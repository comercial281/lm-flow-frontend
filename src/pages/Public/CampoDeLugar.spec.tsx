import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CampoDeLugar from './CampoDeLugar';
import type { PortalProperty } from './portalShared';

const imovel = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: `Imóvel ${code}`, transaction_type: 'sale', property_type: 'apartment',
  listing_kind: 'resale', sale_price_from: 500000, rent_price_from: null,
  address: { city: 'Campinas', neighborhood: 'Centro' }, ...o,
});
const itens = [
  imovel('C1', { condominium_name: 'Collina Parque dos Príncipes' }),
  imovel('C2', { address: { city: 'Campinas', neighborhood: 'Colonial' } }),
];

describe('CampoDeLugar', () => {
  it('digitar "col" mostra o grupo Condomínio e Enter escolhe', async () => {
    const user = userEvent.setup();
    const escolher = vi.fn();
    render(<CampoDeLugar items={itens} tab="sale" texto="col" onTexto={vi.fn()} onEscolher={escolher} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toHaveTextContent('Condomínio');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(escolher).toHaveBeenCalledWith(expect.objectContaining({ filtros: { condominium: 'Collina Parque dos Príncipes' } }));
  });

  it('Esc fecha a lista', async () => {
    const user = userEvent.setup();
    render(<CampoDeLugar items={itens} tab="sale" texto="col" onTexto={vi.fn()} onEscolher={vi.fn()} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Enter sem item ativo chama onConfirmar', async () => {
    const user = userEvent.setup();
    const confirmar = vi.fn();
    render(<CampoDeLugar items={itens} tab="sale" texto="col" onTexto={vi.fn()} onEscolher={vi.fn()} onConfirmar={confirmar} />);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{Enter}');
    expect(confirmar).toHaveBeenCalled();
  });

  it('Enter sem item ativo não é engolido: o formulário em volta recebe o envio', async () => {
    const user = userEvent.setup();
    const enviar = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<form onSubmit={enviar}><CampoDeLugar items={itens} tab="sale" texto="col" onTexto={vi.fn()} onEscolher={vi.fn()} /><button type="submit">ir</button></form>);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{Enter}');
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('abrirPara="cima" abre a lista acima do campo', async () => {
    const user = userEvent.setup();
    render(<CampoDeLugar items={itens} tab="sale" texto="col" onTexto={vi.fn()} onEscolher={vi.fn()} abrirPara="cima" />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox').className).toContain('bottom-full');
  });

  it('clique fora fecha a lista', async () => {
    const user = userEvent.setup();
    render(<div><CampoDeLugar items={itens} tab="sale" texto="col" onTexto={vi.fn()} onEscolher={vi.fn()} /><button>fora</button></div>);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'fora' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Tab sai do campo, fecha a lista e confirma', async () => {
    const user = userEvent.setup();
    const confirmar = vi.fn();
    render(<div><CampoDeLugar items={itens} tab="sale" texto="col" onTexto={vi.fn()} onEscolher={vi.fn()} onConfirmar={confirmar} /><select><option>x</option></select></div>);
    await user.click(screen.getByRole('combobox', { name: 'Condomínio, bairro ou cidade' }));
    await user.keyboard('{Escape}{Tab}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(confirmar).toHaveBeenCalled();
  });
});
