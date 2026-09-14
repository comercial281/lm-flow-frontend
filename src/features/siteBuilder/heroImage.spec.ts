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

    it('explica o imóvel apagado sem nome', () => {
      expect(heroImageWarning({ mode: 'property', property_id: 'im-1', reason: 'imovel_removido' }))
        .toMatch(/apagado/);
    });
  });
});
