import { describe, it, expect } from 'vitest';
import { linkDaRede } from './socialLinks';

describe('linkDaRede', () => {
  it('@usuário vira link', () => {
    expect(linkDaRede('instagram', '@imob.horizonte')).toBe('https://instagram.com/imob.horizonte');
    expect(linkDaRede('tiktok', 'imob')).toBe('https://www.tiktok.com/@imob');
    expect(linkDaRede('youtube', '@imob')).toBe('https://www.youtube.com/@imob');
  });
  it('link completo fica como está; sem protocolo ganha https', () => {
    expect(linkDaRede('facebook', 'https://facebook.com/imob')).toBe('https://facebook.com/imob');
    expect(linkDaRede('linkedin', 'linkedin.com/company/imob')).toBe('https://linkedin.com/company/imob');
  });
  it('vazio vira null', () => {
    expect(linkDaRede('instagram', '   ')).toBeNull();
  });
});
