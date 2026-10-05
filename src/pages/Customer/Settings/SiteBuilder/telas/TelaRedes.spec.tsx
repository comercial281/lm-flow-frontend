import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaRedes from './TelaRedes';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { APARENCIA_FABRICA } from '@/features/siteBuilder/public/aparenciaConfig';

function Montar({ espiao, inicial = {} }: { espiao: (f: Partial<SiteFormData>) => void; inicial?: Partial<SiteFormData> }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', social_links: {}, ...inicial });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaRedes site={null} siteForm={form} setF={setF} />;
}

describe('TelaRedes', () => {
  it('digitar já marca o formulário como alterado; ao sair do campo vira link', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = screen.getByLabelText('Instagram') as HTMLInputElement;
    await userEvent.type(campo, '@imob');
    expect(espiao).toHaveBeenLastCalledWith({ social_links: { instagram: '@imob' } });
    expect(campo.value).toBe('@imob');
    fireEvent.blur(campo);
    expect(espiao).toHaveBeenLastCalledWith({ social_links: { instagram: 'https://instagram.com/imob' } });
    expect(campo.value).toBe('https://instagram.com/imob');
  });

  it('apagar o campo tira a rede da lista ao sair', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = screen.getByLabelText('Instagram');
    await userEvent.type(campo, 'x');
    await userEvent.clear(campo);
    fireEvent.blur(campo);
    expect(espiao).toHaveBeenLastCalledWith({ social_links: {} });
  });

  it('a frase acompanha a Aparência: faixa só com ícones e rodapé compacto', () => {
    const { unmount } = render(<Montar espiao={vi.fn()} />);
    expect(screen.getByText(/O nome de cada rede aparece como link no rodapé de todas as páginas e, no computador, na faixa de cima/)).toBeTruthy();
    unmount();
    render(<Montar espiao={vi.fn()} inicial={{ appearance: { ...APARENCIA_FABRICA, top_bar: 'icons', footer_layout: 'compact' } }} />);
    expect(screen.getByText(/a faixa de cima das páginas internas mostra só o ícone de cada rede\. O rodapé compacto não mostra as redes\./)).toBeTruthy();
  });
});
