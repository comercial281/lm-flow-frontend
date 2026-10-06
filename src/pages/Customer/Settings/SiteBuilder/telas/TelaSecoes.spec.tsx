import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaSecoes from './TelaSecoes';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { HOME_FABRICA, type HomeConfig } from '@/features/siteBuilder/public/homeConfig';

const servico = vi.hoisted(() => ({ uploadAsset: vi.fn() }));
vi.mock('@/services/siteBuilder/siteBuilderService', () => ({ siteBuilderService: servico }));

function Montar({ espiao, home = HOME_FABRICA }: { espiao: (f: Partial<SiteFormData>) => void; home?: HomeConfig }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', home });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaSecoes site={null} siteForm={form} setF={setF} />;
}
const ultimoHome = (espiao: ReturnType<typeof vi.fn>): HomeConfig => espiao.mock.lastCall![0].home;

beforeEach(() => { servico.uploadAsset.mockReset(); });

describe('TelaSecoes', () => {
  it('ligar Como funciona e escrever 2 passos grava home.steps inteiro', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mostrar a seção Como funciona' }));
    expect(ultimoHome(espiao).steps.enabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /Novo passo/ }));
    await userEvent.type(screen.getByLabelText('Título do passo 1'), 'Simule');
    await userEvent.type(screen.getByLabelText('Texto do passo 1'), 'Veja a parcela');
    await userEvent.click(screen.getByRole('button', { name: /Novo passo/ }));
    await userEvent.type(screen.getByLabelText('Título do passo 2'), 'Assine');
    const h = ultimoHome(espiao);
    expect(h.steps).toEqual({ enabled: true, title: 'Como funciona', items: [
      { title: 'Simule', text: 'Veja a parcela' }, { title: 'Assine', text: '' },
    ] });
    // O resto da home segue igual: o servidor troca cada bloco por completo.
    expect(h.search).toEqual(HOME_FABRICA.search);
    expect(h.about).toEqual(HOME_FABRICA.about);
  });

  it('o 5º passo não entra: com 4 o botão some', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: /Novo passo/ }));
    expect(ultimoHome(espiao).steps.items).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /Novo passo/ })).toBeNull();
  });

  it('passo sem título avisa que não é salvo', async () => {
    render(<Montar espiao={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Novo passo/ }));
    expect(screen.getByText(/Sem título, o passo não é salvo/)).toBeTruthy();
  });

  it('remover um passo tira ele da lista depois de confirmar', async () => {
    const espiao = vi.fn();
    const home = { ...HOME_FABRICA, steps: { enabled: true, title: 'Como funciona', items: [{ title: 'A', text: '' }, { title: 'B', text: '' }] } };
    render(<Montar espiao={espiao} home={home} />);
    await userEvent.click(screen.getAllByRole('button', { name: /Remover passo/ })[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'Remover' }));
    expect(ultimoHome(espiao).steps.items).toEqual([{ title: 'B', text: '' }]);
  });

  it('Atendimento: título e texto gravam em home.about; vazio volta a null', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.type(screen.getByLabelText('Título do Atendimento'), 'Fale comigo');
    expect(ultimoHome(espiao).about.title).toBe('Fale comigo');
    await userEvent.clear(screen.getByLabelText('Título do Atendimento'));
    expect(ultimoHome(espiao).about.title).toBeNull();
  });

  it('a foto do Atendimento usa o envio de imagem da casa e grava photo_url', async () => {
    servico.uploadAsset.mockResolvedValue({ url: 'https://cdn/x.jpg' });
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const entrada = screen.getByLabelText('Escolher arquivo: foto do atendimento') as HTMLInputElement;
    await userEvent.upload(entrada, new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    await screen.findByAltText('Foto do atendimento');
    expect(ultimoHome(espiao).about.photo_url).toBe('https://cdn/x.jpg');
  });

  it('o link do botão: Formulário de contato do site grava #contato; https:// grava o endereço', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const seletor = screen.getByLabelText('Para onde o botão leva');
    await userEvent.selectOptions(seletor, '#contato');
    expect(ultimoHome(espiao).about.button_link).toBe('#contato');
    await userEvent.selectOptions(seletor, 'url');
    const campo = screen.getByLabelText('Endereço do botão');
    await userEvent.type(campo, 'ftp://x');
    expect(ultimoHome(espiao).about.button_link).toBeNull();
    expect(screen.getByText(/comece com https:\/\//)).toBeTruthy();
    await userEvent.clear(campo);
    await userEvent.type(campo, 'https://a.com');
    expect(ultimoHome(espiao).about.button_link).toBe('https://a.com');
    expect(within(screen.getByLabelText('Para onde o botão leva')).getByRole('option', { name: 'Formulário de contato do site' })).toBeTruthy();
  });
});
