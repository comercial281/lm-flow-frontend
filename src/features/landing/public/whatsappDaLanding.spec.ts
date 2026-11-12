import { describe, expect, it } from 'vitest';
import { linkDoWhatsappDaLanding, mensagemDaLanding } from './whatsappDaLanding';

describe('whatsappDaLanding', () => {
  it('monta a frase que o servidor reconhece, com o título da página', () => {
    expect(mensagemDaLanding('  Kovacs   Lançamento ')).toBe('Olá! Vim pela página Kovacs Lançamento e quero saber mais.');
  });

  it('sem título, uma frase neutra', () => {
    expect(mensagemDaLanding('')).toBe('Olá! Quero saber mais.');
    expect(mensagemDaLanding(undefined)).toBe('Olá! Quero saber mais.');
  });

  it('link com só os dígitos do telefone e o texto codificado', () => {
    const link = linkDoWhatsappDaLanding('+55 (11) 98888-7777', 'Kovacs');
    expect(link.startsWith('https://wa.me/5511988887777?text=')).toBe(true);
    expect(decodeURIComponent(link.split('?text=')[1])).toBe('Olá! Vim pela página Kovacs e quero saber mais.');
  });
});
