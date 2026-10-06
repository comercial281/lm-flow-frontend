import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaModelo from './TelaModelo';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { APARENCIA_FABRICA } from '@/features/siteBuilder/public/aparenciaConfig';
import { HOME_FABRICA } from '@/features/siteBuilder/public/homeConfig';
import { LISTA_FABRICA } from '@/features/siteBuilder/public/listaConfig';

const aviso = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: aviso }));

interface PropsDaPrevia { urlDoSite?: string; noAr?: boolean; aoPedirPrevia?: () => Promise<string> }

function Montar({ espiao, inicial = {}, previa = {} }: {
  espiao: (f: Partial<SiteFormData>) => void; inicial?: Partial<SiteFormData>; previa?: PropsDaPrevia;
}) {
  const [form, setForm] = useState<SiteFormData>({
    name: 'Imob', primary_color: '#123456', accent_color: '#ABCDEF', font_family: 'Inter',
    appearance: APARENCIA_FABRICA, home: HOME_FABRICA, listing: LISTA_FABRICA, ...inicial,
  });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaModelo site={null} siteForm={form} setF={setF} {...previa} />;
}

const cartao = (nome: string) => screen.getByRole('group', { name: nome });

beforeEach(() => { aviso.success.mockReset(); aviso.error.mockReset(); });

describe('TelaModelo', () => {
  it('mostra os três cartões; o que bate com o site mostra "Em uso" no lugar do botão', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(within(cartao('Clássico')).getByText('Em uso')).toBeTruthy();
    expect(within(cartao('Clássico')).queryByRole('button', { name: 'Usar este modelo' })).toBeNull();
    expect(within(cartao('Editorial')).getByRole('button', { name: 'Usar este modelo' })).toBeTruthy();
    expect(within(cartao('Popular')).getByRole('button', { name: 'Usar este modelo' })).toBeTruthy();
  });

  it('confirmar grava font_family, appearance, home e listing de uma vez, e avisa', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(within(cartao('Editorial')).getByRole('button', { name: 'Usar este modelo' }));
    expect(await screen.findByText('Usar o modelo Editorial?')).toBeTruthy();
    expect(screen.getByText(/Muda a fonte, o fundo, o topo, a capa, o estilo do menu e os cartões\. Suas cores, logo, textos, vitrines e os itens do menu continuam iguais\. Nada vai pro ar antes de você clicar em Salvar\./)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Usar este modelo' }));
    expect(espiao).toHaveBeenCalledTimes(1);
    const patch = espiao.mock.calls[0][0];
    expect(Object.keys(patch).sort()).toEqual(['appearance', 'font_family', 'home', 'listing']);
    expect(patch.font_family).toBe('DM Sans');
    expect(patch.appearance.hero_layout).toBe('split');
    expect(aviso.success).toHaveBeenCalledWith('Modelo aplicado. Confira em Ver prévia e clique em Salvar.');
    expect(within(cartao('Editorial')).getByText('Em uso')).toBeTruthy();
  });

  it('cancelar não chama setF', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(within(cartao('Popular')).getByRole('button', { name: 'Usar este modelo' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(espiao).not.toHaveBeenCalled();
    expect(aviso.success).not.toHaveBeenCalled();
  });

  it('a miniatura usa a cor principal do site', () => {
    render(<Montar espiao={vi.fn()} />);
    const mini = within(cartao('Clássico')).getByTestId('miniatura');
    expect(mini.innerHTML.toLowerCase()).toContain('#123456');
  });

  describe('Ver como fica', () => {
    const novaAba = () => ({ opener: {} as unknown, location: { href: '' }, close: vi.fn() });

    it('cada cartão tem "Ver como fica", inclusive o que está em uso, e a tela explica', () => {
      render(<Montar espiao={vi.fn()} previa={{ urlDoSite: 'https://imob.com.br/', noAr: true, aoPedirPrevia: vi.fn() }} />);
      for (const nome of ['Clássico', 'Editorial', 'Popular']) {
        expect(within(cartao(nome)).getByRole('button', { name: 'Ver como fica' })).toBeTruthy();
      }
      expect(screen.getByText('A prévia abre o seu site com o modelo aplicado, numa aba nova. Nada muda até você usar o modelo e salvar.')).toBeTruthy();
    });

    it('site no ar: abre a aba no clique e põe o endereço do site com modelo=editorial, sem pedir link', async () => {
      const aba = novaAba();
      const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
      const aoPedirPrevia = vi.fn();
      const espiao = vi.fn();
      render(<Montar espiao={espiao} previa={{ urlDoSite: 'https://imob.com.br/', noAr: true, aoPedirPrevia }} />);
      await userEvent.click(within(cartao('Editorial')).getByRole('button', { name: 'Ver como fica' }));
      await waitFor(() => expect(aba.location.href).not.toBe(''));
      expect(abrirJanela).toHaveBeenCalledWith('', '_blank');
      const url = new URL(aba.location.href);
      expect(url.origin).toBe('https://imob.com.br');
      expect(url.searchParams.get('modelo')).toBe('editorial');
      expect(aba.opener).toBeNull();
      expect(aoPedirPrevia).not.toHaveBeenCalled();
      // Ver a prévia não mexe no formulário.
      expect(espiao).not.toHaveBeenCalled();
      abrirJanela.mockRestore();
    });

    it('site em manutenção: usa o link de prévia e mantém o previa= junto do modelo=', async () => {
      const aba = novaAba();
      const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
      const aoPedirPrevia = vi.fn().mockResolvedValue('https://app.lmflow.com.br/portal/imob?previa=tok%2Ba%2Fb%3D%3D--9f');
      render(<Montar espiao={vi.fn()} previa={{ urlDoSite: 'https://app.lmflow.com.br/portal/imob', noAr: false, aoPedirPrevia }} />);
      await userEvent.click(within(cartao('Popular')).getByRole('button', { name: 'Ver como fica' }));
      await waitFor(() => expect(aba.location.href).not.toBe(''));
      expect(aoPedirPrevia).toHaveBeenCalledTimes(1);
      const url = new URL(aba.location.href);
      expect(url.pathname).toBe('/portal/imob');
      expect(url.searchParams.get('previa')).toBe('tok+a/b==--9f');
      expect(url.searchParams.get('modelo')).toBe('popular');
      abrirJanela.mockRestore();
    });

    it('falha ao gerar o link: fecha a aba e avisa', async () => {
      const aba = novaAba();
      const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
      const aoPedirPrevia = vi.fn().mockRejectedValue(new Error('500'));
      render(<Montar espiao={vi.fn()} previa={{ urlDoSite: 'https://imob.com.br/', noAr: false, aoPedirPrevia }} />);
      await userEvent.click(within(cartao('Editorial')).getByRole('button', { name: 'Ver como fica' }));
      await waitFor(() => expect(aba.close).toHaveBeenCalled());
      expect(aba.location.href).toBe('');
      expect(aviso.error).toHaveBeenCalledWith('Não deu para abrir a prévia. Tente de novo.');
      abrirJanela.mockRestore();
    });
  });
});
