import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaChamadas from './TelaChamadas';
import type { Site, SiteFormData, SitePage } from '@/services/siteBuilder/siteBuilderService';
import { HOME_FABRICA, TEXTO_FABRICA, type ChamadaLivre, type HomeConfig } from '@/features/siteBuilder/public/homeConfig';

const servico = vi.hoisted(() => ({ listPages: vi.fn(), uploadAsset: vi.fn() }));
vi.mock('@/services/siteBuilder/siteBuilderService', () => ({ siteBuilderService: servico }));

const pagina = (p: Partial<SitePage>): SitePage => ({
  id: 'p1', site_id: 's1', title: 'Sobre nós', slug: 'sobre', page_kind: 'portal_static', active: true, in_menu: true,
  created_at: '', updated_at: '', ...p,
});

function Montar({ espiao, home = HOME_FABRICA, site = null, zap = '' }:
  { espiao: (f: Partial<SiteFormData>) => void; home?: HomeConfig; site?: Site | null; zap?: string }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', home, contact_whatsapp: zap });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaChamadas site={site} siteForm={form} setF={setF} />;
}

const ultimoHome = (espiao: ReturnType<typeof vi.fn>): HomeConfig => espiao.mock.lastCall![0].home;
const comLivre = (c: ChamadaLivre): HomeConfig => ({ ...HOME_FABRICA, callouts: { ...HOME_FABRICA.callouts, custom: [c] } });

beforeEach(() => {
  servico.listPages.mockReset().mockResolvedValue([]);
  servico.uploadAsset.mockReset();
});

describe('TelaChamadas', () => {
  it('as 3 prontas mostram o texto de fábrica como dica', () => {
    render(<Montar espiao={vi.fn()} />);
    for (const [nome, chave] of [['Financiamento', 'financing'], ['Anuncie seu imóvel', 'listing'], ['Imóvel sob encomenda', 'wanted']] as const) {
      const grupo = within(screen.getByRole('group', { name: nome }));
      expect((grupo.getByLabelText('Título') as HTMLInputElement).placeholder).toBe(TEXTO_FABRICA[chave].title);
      expect((grupo.getByLabelText('Texto') as HTMLInputElement).placeholder).toBe(TEXTO_FABRICA[chave].text);
      expect((grupo.getByLabelText('Botão') as HTMLInputElement).placeholder).toBe(TEXTO_FABRICA[chave].button);
    }
  });

  it('editar o título grava defaults.financing.title; vazio volta a null', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = within(screen.getByRole('group', { name: 'Financiamento' })).getByLabelText('Título');
    await userEvent.type(campo, 'Simule já');
    expect(ultimoHome(espiao).callouts.defaults.financing).toEqual({ enabled: true, title: 'Simule já', text: null, button: null });
    expect(ultimoHome(espiao).callouts.defaults.listing).toEqual(HOME_FABRICA.callouts.defaults.listing);
    await userEvent.clear(campo);
    expect(ultimoHome(espiao).callouts.defaults.financing.title).toBeNull();
  });

  it('escolher o visual Cartões grava layout cards', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    expect(screen.getByRole('button', { name: 'Faixa' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Cartões' }));
    expect(ultimoHome(espiao)).toEqual({ ...HOME_FABRICA, callouts: { ...HOME_FABRICA.callouts, layout: 'cards' } });
    expect(screen.queryByLabelText(/Escurecer a foto/)).toBeNull();
  });

  it('Faixa com foto mostra o envio e a régua de escurecer', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByRole('button', { name: 'Faixa com foto' }));
    expect(screen.getByLabelText('Escurecer a foto · 40%')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Enviar foto/ })).toBeTruthy();
  });

  it('Nova chamada vai até 3', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: /Nova chamada/ }));
    expect(ultimoHome(espiao).callouts.custom).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Nova chamada/ })).toBeNull();
  });

  it('link com ftp:// avisa e não grava; https:// grava', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} home={comLivre({ title: 'Blog', text: null, button: null, dest_type: 'url', dest_value: null })} />);
    const campo = screen.getByLabelText('Endereço');
    await userEvent.type(campo, 'ftp://x');
    expect(screen.getByText('Use um endereço que comece com https://')).toBeTruthy();
    expect(espiao.mock.calls.some(([f]) => JSON.stringify(f).includes('ftp://'))).toBe(false);
    await userEvent.clear(campo);
    await userEvent.type(campo, 'https://blog.imob.com.br');
    expect(screen.queryByText('Use um endereço que comece com https://')).toBeNull();
    expect(ultimoHome(espiao).callouts.custom[0]).toMatchObject({ dest_type: 'url', dest_value: 'https://blog.imob.com.br' });
  });

  it('enquanto digita https:// não acusa erro', async () => {
    render(<Montar espiao={vi.fn()} home={comLivre({ title: 'Blog', text: null, button: null, dest_type: 'url', dest_value: null })} />);
    await userEvent.type(screen.getByLabelText('Endereço'), 'https:/');
    expect(screen.queryByText('Use um endereço que comece com https://')).toBeNull();
  });

  it('destino página lista as páginas do site e avisa se a escolhida está fora do menu', async () => {
    servico.listPages.mockResolvedValue([
      pagina({}), pagina({ id: 'p2', title: 'Vagas', slug: 'vagas', in_menu: false }),
      pagina({ id: 'p3', title: 'Anúncio', slug: 'ad', page_kind: 'ad_landing' }),
    ]);
    const espiao = vi.fn();
    render(<Montar espiao={espiao} site={{ id: 's1' } as Site}
      home={comLivre({ title: 'Sobre', text: null, button: null, dest_type: 'page', dest_value: null })} />);
    const seletor = await screen.findByLabelText('Página');
    expect(await within(seletor).findByRole('option', { name: 'Vagas' })).toBeTruthy();
    expect(within(seletor).queryByRole('option', { name: 'Anúncio' })).toBeNull();
    await userEvent.selectOptions(seletor, 'vagas');
    expect(ultimoHome(espiao).callouts.custom[0]).toMatchObject({ dest_type: 'page', dest_value: 'vagas' });
    expect(screen.getByText(/não está no menu do site/)).toBeTruthy();
  });

  it('WhatsApp sem número em Dados de contato avisa', () => {
    render(<Montar espiao={vi.fn()} home={comLivre({ title: 'Fale', text: null, button: null, dest_type: 'whatsapp', dest_value: null })} />);
    expect(screen.getByText('Usa o WhatsApp de Dados de contato.')).toBeTruthy();
    expect(screen.getByText(/ainda não tem WhatsApp/)).toBeTruthy();
  });

  it('trocar o destino limpa o valor anterior', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} zap="5511999999999"
      home={comLivre({ title: 'Blog', text: null, button: null, dest_type: 'url', dest_value: 'https://a.com' })} />);
    await userEvent.selectOptions(screen.getByLabelText('Destino'), 'whatsapp');
    expect(ultimoHome(espiao).callouts.custom[0]).toMatchObject({ dest_type: 'whatsapp', dest_value: null });
    expect(screen.queryByText(/ainda não tem WhatsApp/)).toBeNull();
  });

  it('enquanto as páginas não chegam, não afirma nada: sem "Página excluída", sem aviso de menu', async () => {
    let responder!: (l: SitePage[]) => void;
    servico.listPages.mockReturnValue(new Promise<SitePage[]>(r => { responder = r; }));
    render(<Montar espiao={vi.fn()} site={{ id: 's1' } as Site}
      home={comLivre({ title: 'Sobre', text: null, button: null, dest_type: 'page', dest_value: 'sobre' })} />);

    const seletor = screen.getByLabelText('Página') as HTMLSelectElement;
    expect(within(seletor).queryByRole('option', { name: 'Página excluída' })).toBeNull();
    expect(seletor.value).toBe('sobre');
    expect(screen.queryByText(/não está no menu do site/)).toBeNull();
    expect(screen.queryByText(/Você ainda não tem páginas/)).toBeNull();

    await act(async () => { responder([pagina({ slug: 'outra', title: 'Outra' })]); });
    expect(within(seletor).getByRole('option', { name: 'Página excluída' })).toBeTruthy();
    expect(screen.getByText(/não está no menu do site/)).toBeTruthy();
  });

  it('se a lista de páginas falha, mostra que não deu pra carregar (e nada de "excluída")', async () => {
    servico.listPages.mockRejectedValue(new Error('rede'));
    render(<Montar espiao={vi.fn()} site={{ id: 's1' } as Site}
      home={comLivre({ title: 'Sobre', text: null, button: null, dest_type: 'page', dest_value: 'sobre' })} />);

    expect(await screen.findByText('Não deu pra carregar as páginas do site agora.')).toBeTruthy();
    expect(within(screen.getByLabelText('Página')).queryByRole('option', { name: 'Página excluída' })).toBeNull();
    expect(screen.queryByText(/não está no menu do site/)).toBeNull();
    expect(screen.queryByText(/Você ainda não tem páginas/)).toBeNull();
  });

  it('destino Um link sem endereço http(s) válido avisa que a chamada não é salva', async () => {
    render(<Montar espiao={vi.fn()} home={comLivre({ title: 'Blog', text: null, button: null, dest_type: 'url', dest_value: null })} />);
    const aviso = /Sem um link que comece com http:\/\/ ou https:\/\/, a chamada não é salva/;
    expect(screen.getByText(aviso)).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Endereço'), 'https://blog.imob.com.br');
    expect(screen.queryByText(aviso)).toBeNull();
  });

  it('Remover chamada pede confirmação', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} home={comLivre({ title: 'Blog', text: null, button: null, dest_type: 'url', dest_value: 'https://a.com' })} />);
    await userEvent.click(screen.getByRole('button', { name: /Remover/ }));
    expect(espiao).not.toHaveBeenCalled();
    const dialogo = within(screen.getByRole('dialog'));
    expect(dialogo.getByText(/"Blog"/)).toBeTruthy();
    await userEvent.click(dialogo.getByRole('button', { name: 'Remover' }));
    expect(ultimoHome(espiao).callouts.custom).toEqual([]);
  });

  it('Financiamento e Anuncie dizem se a página está ligada, pelo último salvo', () => {
    const site = { id: 's1', financiamento: { enabled: true }, anuncie: { enabled: false } } as unknown as Site;
    render(<Montar espiao={vi.fn()} site={site} />);

    const fin = within(screen.getByRole('group', { name: 'Financiamento' }));
    expect(fin.getByText('Página ligada')).toBeTruthy();
    expect(fin.queryByText(/Página desligada/)).toBeNull();

    const anuncie = within(screen.getByRole('group', { name: 'Anuncie seu imóvel' }));
    expect(anuncie.getByText(/^Página desligada: a chamada não aparece no site\./)).toBeTruthy();
    expect(anuncie.getByText(/salve para valer/)).toBeTruthy();
    expect(anuncie.queryByText('Página ligada')).toBeNull();

    // Encomenda leva pro formulário da página inicial: não tem página pra ligar.
    const encomenda = within(screen.getByRole('group', { name: 'Imóvel sob encomenda' }));
    expect(encomenda.queryByText(/Página (ligada|desligada)/)).toBeNull();
  });

  it('site salvo sem os dados da página: Financiamento e Anuncie contam como desligadas', () => {
    render(<Montar espiao={vi.fn()} site={{ id: 's1' } as Site} />);

    for (const nome of ['Financiamento', 'Anuncie seu imóvel']) {
      expect(within(screen.getByRole('group', { name: nome })).getByText(/^Página desligada/)).toBeTruthy();
    }
  });
});
