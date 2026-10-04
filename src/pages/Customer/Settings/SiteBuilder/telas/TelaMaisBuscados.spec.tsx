import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaMaisBuscados from './TelaMaisBuscados';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { HOME_FABRICA } from '@/features/siteBuilder/public/homeConfig';

function Montar({ espiao, home = HOME_FABRICA }: { espiao: (f: Partial<SiteFormData>) => void; home?: typeof HOME_FABRICA }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imob', home });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaMaisBuscados site={null} siteForm={form} setF={setF} />;
}

const atalho = (label: string) => ({ label, transaction: 'sale' as const, property_type: null, city: null, neighborhood: null, price_max: null });

describe('TelaMaisBuscados', () => {
  it('automático mostra a frase e esconde a lista; Escolher eu mesmo abre o manual', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    expect(screen.getByText('Atualiza sozinho quando você cadastra ou vende imóveis.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Escolher eu mesmo' }));
    expect(espiao).toHaveBeenLastCalledWith({ home: { ...HOME_FABRICA, most_searched: { ...HOME_FABRICA.most_searched, mode: 'manual' } } });
    expect(screen.getByRole('button', { name: /Adicionar atalho/ })).toBeTruthy();
  });

  it('adiciona e remove atalho; o botão some no 8º', async () => {
    const espiao = vi.fn();
    const manual = { ...HOME_FABRICA, most_searched: { enabled: true, mode: 'manual' as const, items: Array.from({ length: 7 }, (_, i) => atalho(`A${i}`)) } };
    render(<Montar espiao={espiao} home={manual} />);
    await userEvent.click(screen.getByRole('button', { name: /Adicionar atalho/ }));
    expect(screen.queryByRole('button', { name: /Adicionar atalho/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Remover/ })).toHaveLength(8);
    await userEvent.click(screen.getAllByRole('button', { name: /Remover/ })[0]);
    expect(screen.getAllByRole('button', { name: /Remover/ })).toHaveLength(7);
    expect(screen.getByRole('button', { name: /Adicionar atalho/ })).toBeTruthy();
  });

  it('desmarcar a caixinha manda o home inteiro com enabled false', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.click(screen.getByLabelText('Mostrar mais buscados na página inicial'));
    expect(espiao).toHaveBeenCalledWith({ home: { ...HOME_FABRICA, most_searched: { ...HOME_FABRICA.most_searched, enabled: false } } });
  });
});
