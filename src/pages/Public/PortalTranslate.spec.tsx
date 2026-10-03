import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PortalTranslate from './PortalTranslate';

describe('PortalTranslate', () => {
  afterEach(() => {
    document.getElementById('lmf-gt-script')?.remove();
    delete (window as unknown as { google?: unknown }).google;
    delete (window as unknown as { __lmfTranslateInit?: unknown }).__lmfTranslateInit;
  });

  it('remonta o botão ao navegar: reinicia na div nova e injeta o script uma vez só', () => {
    const first = render(<PortalTranslate languages={['en', 'es']} />);
    expect(document.querySelectorAll('#lmf-gt-script')).toHaveLength(1);
    first.unmount();

    const ctor = vi.fn();
    (window as unknown as { google: unknown }).google = { translate: { TranslateElement: ctor } };
    render(<PortalTranslate languages={['en', 'es']} />);

    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor.mock.calls[0][1]).toBe('lmf-google-translate');
    expect(ctor.mock.calls[0][0]).toMatchObject({ includedLanguages: 'en,es' });
    expect(document.querySelectorAll('#lmf-gt-script')).toHaveLength(1);
  });

  it('sem idiomas, não desenha nada', () => {
    const { container } = render(<PortalTranslate languages={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
