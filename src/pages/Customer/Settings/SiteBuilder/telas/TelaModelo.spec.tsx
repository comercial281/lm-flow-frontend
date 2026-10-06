import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaModelo from './TelaModelo';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { APARENCIA_FABRICA } from '@/features/siteBuilder/public/aparenciaConfig';
import { HOME_FABRICA } from '@/features/siteBuilder/public/homeConfig';
import { LISTA_FABRICA } from '@/features/siteBuilder/public/listaConfig';

const aviso = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: aviso }));

function Montar({ espiao, inicial = {} }: { espiao: (f: Partial<SiteFormData>) => void; inicial?: Partial<SiteFormData> }) {
  const [form, setForm] = useState<SiteFormData>({
    name: 'Imob', primary_color: '#123456', accent_color: '#ABCDEF', font_family: 'Inter',
    appearance: APARENCIA_FABRICA, home: HOME_FABRICA, listing: LISTA_FABRICA, ...inicial,
  });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaModelo site={null} siteForm={form} setF={setF} />;
}

const cartao = (nome: string) => screen.getByRole('group', { name: nome });

beforeEach(() => { aviso.success.mockReset(); });

describe('TelaModelo', () => {
  it('mostra os três cartões; o que bate com o site mostra "Em uso" no lugar do botão', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(within(cartao('Clássico')).getByText('Em uso')).toBeTruthy();
    expect(within(cartao('Clássico')).queryByRole('button')).toBeNull();
    expect(within(cartao('Editorial')).getByRole('button', { name: 'Usar este modelo' })).toBeTruthy();
    expect(within(cartao('Popular')).getByRole('button', { name: 'Usar este modelo' })).toBeTruthy();
  });

  it('confirmar grava font_family, appearance, home e listing de uma vez, e avisa', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(within(cartao('Editorial')).getByRole('button', { name: 'Usar este modelo' }));
    expect(await screen.findByText('Usar o modelo Editorial?')).toBeTruthy();
    expect(screen.getByText(/Muda a fonte, o fundo, o topo, a capa, o menu e os cartões\. Suas cores, logo, textos, vitrines e menu continuam iguais\. Nada vai pro ar antes de você clicar em Salvar\./)).toBeTruthy();
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
});
