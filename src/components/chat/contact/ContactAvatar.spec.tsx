import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ContactAvatar from './ContactAvatar';

// Foto do lead em branco (relato do dono, 02/10): o mesmo avatar fica montado
// enquanto o lead troca (painel do lead e topo da conversa não remontam ao trocar
// de conversa). O Avatar do Radix guarda "a foto carregou" e só mostra as
// iniciais quando NÃO carregou; ao ir de um lead com foto para um sem foto, a
// imagem sai mas o "carregou" ficava, e o círculo ficava vazio.

vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));

// jsdom não baixa imagem: esta "carrega" logo depois de receber o endereço.
class ImagemQueCarrega extends EventTarget {
  complete = false;
  naturalWidth = 0;
  referrerPolicy = '';
  crossOrigin: string | null = null;
  private endereco = '';
  get src() {
    return this.endereco;
  }
  set src(valor: string) {
    this.endereco = valor;
    this.complete = false;
    setTimeout(() => {
      this.complete = true;
      this.naturalWidth = 100;
      this.dispatchEvent(new Event('load'));
    }, 0);
  }
}

describe('ContactAvatar', () => {
  beforeEach(() => vi.stubGlobal('Image', ImagemQueCarrega));
  afterEach(() => vi.unstubAllGlobals());

  it('lead sem foto mostra as iniciais', () => {
    render(<ContactAvatar contact={{ id: 'b', name: 'Bruno Lima', thumbnail: '' }} />);
    expect(screen.getByText('BL')).toBeTruthy();
  });

  it('trocar de um lead com foto para um sem foto mostra as iniciais (não fica em branco)', async () => {
    const { rerender } = render(
      <ContactAvatar contact={{ id: 'a', name: 'Ana Souza', thumbnail: 'https://exemplo.com/ana.jpg' }} />,
    );
    // A foto da Ana carregou: aparece a foto, sem as iniciais.
    expect(await screen.findByRole('img')).toBeTruthy();
    expect(screen.queryByText('AS')).toBeNull();

    rerender(<ContactAvatar contact={{ id: 'b', name: 'Bruno Lima', thumbnail: '' }} />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('BL')).toBeTruthy();
  });

  it('trocar de lead com foto para outro com foto mostra a foto nova', async () => {
    const { rerender } = render(
      <ContactAvatar contact={{ id: 'a', name: 'Ana Souza', thumbnail: 'https://exemplo.com/ana.jpg' }} />,
    );
    expect(await screen.findByRole('img')).toBeTruthy();

    rerender(<ContactAvatar contact={{ id: 'c', name: 'Caio Reis', thumbnail: 'https://exemplo.com/caio.jpg' }} />);
    const foto = await screen.findByRole('img');
    expect(foto.getAttribute('src')).toBe('https://exemplo.com/caio.jpg');
  });
});
