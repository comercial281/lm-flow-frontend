import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaEndereco from './TelaEndereco';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';

const form = { name: 'Imob', slug: 'imob', active: true, published: true } as SiteFormData;

describe('TelaEndereco · bloco No ar', () => {
  it('diz o que as caixas fazem hoje: desmarcar põe o site em manutenção', () => {
    render(<TelaEndereco site={null} siteForm={form} setF={vi.fn()} aoCriar={vi.fn()} salvando={false} />);

    expect(screen.getByRole('heading', { name: 'No ar' })).toBeTruthy();
    expect(screen.getByText(
      'Com as duas marcadas, o site fica aberto pra todo mundo. Desmarcando qualquer uma, o site mostra a página Em manutenção; a página de um imóvel aberta por link continua funcionando.',
    )).toBeTruthy();
    expect(screen.queryByText(/continua abrindo para os visitantes/)).toBeNull();
    expect(screen.queryByText('Selo No ar')).toBeNull();
  });

  it('desmarcar Publicado avisa o formulário', async () => {
    const setF = vi.fn();
    render(<TelaEndereco site={null} siteForm={form} setF={setF} aoCriar={vi.fn()} salvando={false} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Publicado' }));
    expect(setF).toHaveBeenCalledWith({ published: false });
  });
});
