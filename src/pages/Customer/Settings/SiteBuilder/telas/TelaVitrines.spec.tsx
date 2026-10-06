import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaVitrines from './TelaVitrines';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { HOME_FABRICA, type HomeConfig, type RegrasVitrine, type Vitrine } from '@/features/siteBuilder/public/homeConfig';

function Montar({ espiao, home = HOME_FABRICA }: { espiao: (f: Partial<SiteFormData>) => void; home?: HomeConfig }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', home });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaVitrines site={null} siteForm={form} setF={setF} />;
}

const REGRA: RegrasVitrine = {
  transaction: null, listing_kind: null, property_types: [], cities: [], neighborhoods: [],
  price_min: null, price_max: null, stages: [], featured_only: false,
};
const livre = (id: string, title = 'Vitrine'): Vitrine => ({ id, kind: 'custom', enabled: true, title, rules: { ...REGRA } });
const ultimoHome = (espiao: ReturnType<typeof vi.fn>): HomeConfig => espiao.mock.lastCall![0].home;

describe('TelaVitrines', () => {
  it('com a fábrica mostra as duas com caixinha e título editável, sem Remover', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(screen.getByDisplayValue('Lançamentos')).toBeTruthy();
    expect(screen.getByDisplayValue('Imóveis em destaque')).toBeTruthy();
    expect(screen.getAllByLabelText('Mostrar')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar regra/ })).toBeNull();
  });

  it('trocar o título da de fábrica grava o home inteiro', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = screen.getByDisplayValue('Lançamentos');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Na planta');
    expect(ultimoHome(espiao)).toEqual({
      ...HOME_FABRICA,
      showcases: [{ ...HOME_FABRICA.showcases[0], title: 'Na planta' }, HOME_FABRICA.showcases[1]],
    });
  });

  it('Nova vitrine acrescenta uma livre "Vitrine" com o editor de regra aberto', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByRole('button', { name: /Nova vitrine/ }));
    const lista = ultimoHome(espiao).showcases;
    expect(lista).toHaveLength(3);
    expect(lista[2]).toMatchObject({ kind: 'custom', enabled: true, title: 'Vitrine', rules: REGRA });
    expect(lista[2].id).toMatch(/^[a-zA-Z0-9_-]{4,40}$/);
    expect(['launches', 'featured']).not.toContain(lista[2].id);
    expect(screen.getByRole('group', { name: 'Finalidade' })).toBeTruthy();
  });

  it('o botão Nova vitrine some com 6', () => {
    const home = { ...HOME_FABRICA, showcases: [...HOME_FABRICA.showcases, livre('a'), livre('b'), livre('c'), livre('d')] };
    render(<Montar espiao={vi.fn()} home={home} />);
    expect(screen.queryByRole('button', { name: /Nova vitrine/ })).toBeNull();
  });

  it('Até R$ 500000 grava rules.price_max = 500000', async () => {
    const espiao = vi.fn();
    const home = { ...HOME_FABRICA, showcases: [...HOME_FABRICA.showcases, livre('praia', 'Na praia')] };
    render(<Montar espiao={espiao} home={home} />);
    await userEvent.click(screen.getByRole('button', { name: /Editar regra/ }));
    await userEvent.type(screen.getByLabelText('Até R$'), '500000');
    expect(ultimoHome(espiao).showcases[2].rules).toEqual({ ...REGRA, price_max: 500000 });
  });

  it('Revenda esconde as fases e limpa as marcadas; Comprar grava transaction', async () => {
    const espiao = vi.fn();
    const home = { ...HOME_FABRICA, showcases: [...HOME_FABRICA.showcases, { ...livre('x'), rules: { ...REGRA, stages: ['ready'] } }] };
    render(<Montar espiao={espiao} home={home} />);
    await userEvent.click(screen.getByRole('button', { name: /Editar regra/ }));
    expect(screen.getByLabelText('Pronto para morar')).toBeTruthy();
    await userEvent.click(within(screen.getByRole('group', { name: 'Cadastro' })).getByRole('button', { name: 'Revenda' }));
    expect(ultimoHome(espiao).showcases[2].rules).toMatchObject({ listing_kind: 'resale', stages: [] });
    expect(screen.queryByLabelText('Pronto para morar')).toBeNull();
    await userEvent.click(within(screen.getByRole('group', { name: 'Finalidade' })).getByRole('button', { name: 'Comprar' }));
    expect(ultimoHome(espiao).showcases[2].rules?.transaction).toBe('sale');
  });

  it('cidades separadas por vírgula viram lista', async () => {
    const espiao = vi.fn();
    const home = { ...HOME_FABRICA, showcases: [...HOME_FABRICA.showcases, livre('x')] };
    render(<Montar espiao={espiao} home={home} />);
    await userEvent.click(screen.getByRole('button', { name: /Editar regra/ }));
    await userEvent.type(screen.getByLabelText('Cidades'), 'Santos, Guarujá,');
    expect(ultimoHome(espiao).showcases[2].rules?.cities).toEqual(['Santos', 'Guarujá']);
    expect((screen.getByLabelText('Cidades') as HTMLInputElement).value).toBe('Santos, Guarujá,');
  });

  it('Descer troca a ordem', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Descer' })[0]);
    expect(ultimoHome(espiao).showcases.map(v => v.id)).toEqual(['featured', 'launches']);
  });

  it('Remover pede confirmação e tira a livre', async () => {
    const espiao = vi.fn();
    const home = { ...HOME_FABRICA, showcases: [...HOME_FABRICA.showcases, livre('x', 'Na praia')] };
    render(<Montar espiao={espiao} home={home} />);
    await userEvent.click(screen.getByRole('button', { name: /Remover/ }));
    expect(espiao).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));
    expect(ultimoHome(espiao).showcases.map(v => v.id)).toEqual(['launches', 'featured']);
  });

  it('De R$ maior que Até R$ avisa que a vitrine fica vazia', async () => {
    const home = { ...HOME_FABRICA, showcases: [...HOME_FABRICA.showcases, livre('x')] };
    render(<Montar espiao={vi.fn()} home={home} />);
    await userEvent.click(screen.getByRole('button', { name: /Editar regra/ }));
    const aviso = /De R\$ está maior que o de Até R\$/;
    await userEvent.type(screen.getByLabelText('De R$'), '900000');
    expect(screen.queryByText(aviso)).toBeNull();
    await userEvent.type(screen.getByLabelText('Até R$'), '500000');
    expect(screen.getByText(aviso)).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('De R$'));
    expect(screen.queryByText(aviso)).toBeNull();
  });

  it('a caixinha de destaque diz "Só destaques e exclusivos"', async () => {
    const espiao = vi.fn();
    const home = { ...HOME_FABRICA, showcases: [...HOME_FABRICA.showcases, livre('x')] };
    render(<Montar espiao={espiao} home={home} />);
    await userEvent.click(screen.getByRole('button', { name: /Editar regra/ }));
    await userEvent.click(screen.getByLabelText('Só destaques e exclusivos'));
    expect(ultimoHome(espiao).showcases[2].rules?.featured_only).toBe(true);
  });

  it('a caixinha "Só Minha Casa Minha Vida" grava rules.mcmv', async () => {
    const espiao = vi.fn();
    const home = { ...HOME_FABRICA, showcases: [...HOME_FABRICA.showcases, livre('x')] };
    render(<Montar espiao={espiao} home={home} />);
    await userEvent.click(screen.getByRole('button', { name: /Editar regra/ }));
    const caixa = screen.getByLabelText('Só Minha Casa Minha Vida');
    await userEvent.click(caixa);
    expect(ultimoHome(espiao).showcases[2].rules?.mcmv).toBe(true);
    await userEvent.click(caixa);
    expect(ultimoHome(espiao).showcases[2].rules?.mcmv).toBe(false);
  });
});
