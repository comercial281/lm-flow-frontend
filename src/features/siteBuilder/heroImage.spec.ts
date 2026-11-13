import { describe, it, expect } from 'vitest';
import { heroImageChoiceFrom, heroImageWarning } from './heroImage';

describe('foto do banner da home', () => {
  describe('a escolha gravada vira formulário', () => {
    it('sem nada gravado é automático', () => {
      expect(heroImageChoiceFrom(undefined)).toEqual({ mode: 'auto' });
      expect(heroImageChoiceFrom({ mode: 'auto' })).toEqual({ mode: 'auto' });
    });

    it('leva só o que pertence ao modo', () => {
      expect(heroImageChoiceFrom({
        mode: 'property', property_id: 'im-1', photo_id: 'ft-2',
        url: 'https://cdn/x.jpg', property: { id: 'im-1', title: 'Apto', code: 'AP1' },
      })).toEqual({ mode: 'property', property_id: 'im-1', photo_id: 'ft-2' });

      expect(heroImageChoiceFrom({ mode: 'upload', url: 'https://cdn/banner.jpg' }))
        .toEqual({ mode: 'upload', url: 'https://cdn/banner.jpg' });
    });

    it('escolha sem alvo volta ao automático', () => {
      expect(heroImageChoiceFrom({ mode: 'property' })).toEqual({ mode: 'auto' });
      expect(heroImageChoiceFrom({ mode: 'upload', url: '' })).toEqual({ mode: 'auto' });
    });
  });

  describe('aviso quando a escolha deixou de valer', () => {
    it('não avisa quando está tudo certo, nem fora do modo imóvel', () => {
      expect(heroImageWarning({ mode: 'property', property_id: 'im-1', url: 'https://cdn/a.jpg' })).toBeNull();
      expect(heroImageWarning({ mode: 'upload', url: 'https://cdn/a.jpg' })).toBeNull();
      expect(heroImageWarning({ mode: 'auto' })).toBeNull();
    });

    it('explica com o nome do imóvel quando ele ainda existe', () => {
      const msg = heroImageWarning({
        mode: 'property', property_id: 'im-1', reason: 'imovel_despublicado',
        property: { id: 'im-1', title: 'Apto Vila Mariana', code: 'AP1' },
      });
      expect(msg).toContain('«Apto Vila Mariana»');
      expect(msg).toContain('automático');
    });

    it('explica o imóvel excluído sem nome', () => {
      expect(heroImageWarning({ mode: 'property', property_id: 'im-1', reason: 'imovel_removido' }))
        .toMatch(/excluído/);
    });

    it('com outras fotos no banner não fala em automático: a foto principal sai e o banner segue com as outras', () => {
      const base = { mode: 'property' as const, property_id: 'im-1', property: { id: 'im-1', title: 'Apto Vila Mariana', code: 'AP1' } };
      expect(heroImageWarning({ ...base, reason: 'imovel_despublicado' }, true))
        .toBe('A foto principal saiu do banner: o imóvel «Apto Vila Mariana» não está mais publicado no site. O banner segue com as outras fotos.');
      expect(heroImageWarning({ ...base, reason: 'imovel_removido' }, true))
        .toBe('A foto principal saiu do banner: o imóvel escolhido foi excluído. O banner segue com as outras fotos.');
      expect(heroImageWarning({ ...base, reason: 'imovel_sem_foto' }, true)).not.toMatch(/automático/);
      expect(heroImageWarning({ ...base, reason: 'erro' }, true)).not.toMatch(/automático/);
      expect(heroImageWarning({ ...base, url: 'https://cdn/a.jpg' }, true)).toBeNull();
    });

    it('extra conta como outra foto só quando o servidor ainda serve a imagem', async () => {
      const { temExtraNoBanner } = await import('./heroImage');
      expect(temExtraNoBanner(undefined)).toBe(false);
      expect(temExtraNoBanner([{ mode: 'property', property_id: 'im-2', reason: 'imovel_despublicado' }])).toBe(false);
      expect(temExtraNoBanner([{ mode: 'upload', url: 'https://cdn/b.jpg' }])).toBe(true);
    });
  });
});

describe('fotos extras do banner', () => {
  it('sem nada gravado é lista vazia', async () => {
    const { extrasFrom } = await import('./heroImage');
    expect(extrasFrom(undefined)).toEqual([]);
    expect(extrasFrom(null)).toEqual([]);
  });

  it('leva só o que pertence ao modo e descarta o vazio, na mesma ordem', async () => {
    const { extrasFrom } = await import('./heroImage');
    expect(extrasFrom([
      { mode: 'property', property_id: 'im-1', photo_id: 'ft-1', url: 'https://cdn/a.jpg' },
      { mode: 'upload', url: '' },
      { mode: 'auto' },
      { mode: 'property' },
      { mode: 'upload', url: 'https://cdn/b.jpg' },
    ])).toEqual([
      { mode: 'property', property_id: 'im-1', photo_id: 'ft-1' },
      { mode: 'upload', url: 'https://cdn/b.jpg' },
    ]);
  });

  it('limita a 5, guardando as primeiras', async () => {
    const { extrasFrom, MAX_FOTOS_EXTRAS } = await import('./heroImage');
    expect(MAX_FOTOS_EXTRAS).toBe(5);
    const lista = extrasFrom(Array.from({ length: 7 }, (_, i) => ({ mode: 'upload' as const, url: `https://cdn/${i}.jpg` })));
    expect(lista.map(c => c.url)).toEqual([0, 1, 2, 3, 4].map(i => `https://cdn/${i}.jpg`));
  });

  it('aviso próprio da extra: a foto sai do banner, não vai pro automático', async () => {
    const { extraPhotoWarning } = await import('./heroImage');
    const base = { mode: 'property' as const, property_id: 'im-1' };
    expect(extraPhotoWarning({ ...base, reason: 'imovel_removido' })).toBe('Esta foto saiu do banner: o imóvel foi excluído.');
    expect(extraPhotoWarning({ ...base, reason: 'imovel_despublicado' })).toBe('Esta foto saiu do banner: o imóvel foi despublicado.');
    expect(extraPhotoWarning({ ...base, reason: 'imovel_sem_foto' })).toBe('Esta foto saiu do banner: a foto não está mais publicada.');
    expect(extraPhotoWarning({ ...base, reason: 'erro' })).toBe('Esta foto saiu do banner: não deu para carregar.');
    expect(extraPhotoWarning({ ...base, url: 'https://cdn/a.jpg' })).toBeNull();
    expect(extraPhotoWarning(undefined)).toBeNull();
  });
});
