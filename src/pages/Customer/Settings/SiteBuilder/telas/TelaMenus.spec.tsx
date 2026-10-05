import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MenuDoPainel, Site, SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { menuDoPainel } from '@/features/siteBuilder/menuDoPainel';

const mocks = vi.hoisted(() => ({ listPages: vi.fn() }));
vi.mock('@/services/siteBuilder/siteBuilderService', () => ({ siteBuilderService: { listPages: mocks.listPages } }));

import TelaMenus from './TelaMenus';

const ADMIN = {
  items: [
    { key: 'sale', label: null, enabled: true },
    { key: 'rent', label: null, enabled: true },
    { key: 'launch', label: null, enabled: true },
    { key: 'about', label: null, enabled: true },
    { key: 'contact', label: null, enabled: true },
    { key: 'financing', label: null, enabled: true },
    { key: 'listing', label: null, enabled: true },
    { key: 'page:quem-somos', label: null, enabled: false, page_title: 'Quem somos' },
    { key: 'blog', label: null, enabled: true },
  ],
  external: [],
};

const SITE = { id: 's1', financiamento: { enabled: false }, anuncie: { enabled: true } } as unknown as Site;

function Montar({ espiao, inicial = {} }: { espiao: (f: Partial<SiteFormData>) => void; inicial?: Partial<SiteFormData> }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', menu: menuDoPainel(ADMIN), ...inicial });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaMenus site={SITE} siteForm={form} setF={setF} />;
}

const ultimoMenu = (espiao: ReturnType<typeof vi.fn>) => espiao.mock.calls.at(-1)![0].menu as MenuDoPainel;

describe('TelaMenus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPages.mockResolvedValue([
      { id: 'p1', slug: 'quem-somos', title: 'Quem somos', active: false, in_menu: false, page_kind: 'portal_static' },
    ]);
  });

  it('abrir não grava nada; os nomes de fábrica são o placeholder', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await waitFor(() => expect(mocks.listPages).toHaveBeenCalledWith('s1'));
    expect(espiao).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nome no menu: Sobre').getAttribute('placeholder')).toBe('Sobre');
    expect(screen.getByLabelText('Nome no menu: Anuncie seu imóvel').getAttribute('placeholder')).toBe('Anuncie seu imóvel');
    expect(screen.getByLabelText('Nome no menu: Quem somos').getAttribute('placeholder')).toBe('Quem somos');
  });

  it('a ajuda diz que o rodapé passa a repetir o menu depois de salvar', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(screen.getByText(/Depois que você salvar esta tela, o rodapé do site passa a repetir este menu/)).toBeTruthy();
  });

  it('reordenar: Descer troca com o de baixo e manda o menu inteiro', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByRole('button', { name: 'Descer Comprar' }));
    const menu = ultimoMenu(espiao);
    expect(menu.items.map(i => i.key).slice(0, 3)).toEqual(['rent', 'sale', 'launch']);
    expect(menu.items).toHaveLength(9);
    expect(menu.external).toEqual([]);
    expect((screen.getByRole('button', { name: 'Subir Alugar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('desligar um item grava enabled false', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByLabelText('Mostrar Alugar no menu'));
    expect(ultimoMenu(espiao).items.find(i => i.key === 'rent')!.enabled).toBe(false);
  });

  it('ligar uma página grava enabled true nela (o "Exibir no menu" dela)', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByLabelText('Mostrar Quem somos no menu'));
    expect(ultimoMenu(espiao).items.find(i => i.key === 'page:quem-somos')!.enabled).toBe(true);
  });

  it('renomear grava o nome; apagar o nome volta a null (nome de fábrica)', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = screen.getByLabelText('Nome no menu: Blog');
    await userEvent.type(campo, 'Notícias');
    expect(ultimoMenu(espiao).items.find(i => i.key === 'blog')!.label).toBe('Notícias');
    await userEvent.clear(campo);
    expect(ultimoMenu(espiao).items.find(i => i.key === 'blog')!.label).toBeNull();
  });

  it('item ligado sem destino avisa: página desativada e financiamento desligado', async () => {
    render(<Montar espiao={vi.fn()} inicial={{ menu: menuDoPainel({ ...ADMIN, items: ADMIN.items.map(i => ({ ...i, enabled: true })) }) }} />);
    expect(await screen.findByText('Página desativada em Páginas: não aparece no site até ser ativada.')).toBeTruthy();
    expect(screen.getByText('Página de financiamento desligada: não aparece no site.')).toBeTruthy();
    expect(screen.queryByText(/Anuncie seu imóvel desligada/)).toBeNull();
  });

  describe('Links externos', () => {
    it('endereço que não é http(s) avisa em âmbar', async () => {
      const espiao = vi.fn();
      render(<Montar espiao={espiao} />);
      await userEvent.click(screen.getByRole('button', { name: 'Adicionar link' }));
      await userEvent.type(screen.getByLabelText('Nome no menu'), 'CRECI');
      await userEvent.type(screen.getByLabelText('Endereço'), 'www.creci.org.br');
      expect(screen.getByText('Sem um endereço que comece com http:// ou https://, o link não é salvo.')).toBeTruthy();
      await userEvent.clear(screen.getByLabelText('Endereço'));
      await userEvent.type(screen.getByLabelText('Endereço'), 'https://creci.org.br');
      expect(screen.queryByText(/o link não é salvo/)).toBeNull();
      expect(ultimoMenu(espiao).external).toEqual([{ label: 'CRECI', url: 'https://creci.org.br' }]);
    });

    it('o 4º externo não é possível: o botão some no 3º', async () => {
      render(<Montar espiao={vi.fn()} />);
      for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: 'Adicionar link' }));
      expect(screen.getAllByLabelText('Endereço')).toHaveLength(3);
      expect(screen.queryByRole('button', { name: 'Adicionar link' })).toBeNull();
    });

    it('remover pede confirmação', async () => {
      const espiao = vi.fn();
      render(<Montar espiao={espiao} inicial={{ menu: { ...menuDoPainel(ADMIN), external: [{ label: 'CRECI', url: 'https://creci.org.br/' }] } }} />);
      await userEvent.click(screen.getByRole('button', { name: 'Remover o link CRECI' }));
      expect(espiao).not.toHaveBeenCalled();
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));
      expect(ultimoMenu(espiao).external).toEqual([]);
    });
  });
});
