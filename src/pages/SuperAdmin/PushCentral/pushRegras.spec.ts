// src/pages/SuperAdmin/PushCentral/pushRegras.spec.ts
import { describe, it, expect } from 'vitest';
import { STATUS_CLASS, pedidoDeDisparo, textoDoPublico } from './pushRegras';

describe('Push: público e quantidade antes do disparo', () => {
  it('para a Leal Mídia com uma pessoa: texto neutro, não "você"', () => {
    expect(pedidoDeDisparo('admin', { people: 1, devices: 2 }, '').titulo).toBe('Enviar para 1 pessoa da Leal Mídia (2 aparelhos)?');
    expect(textoDoPublico('admin', { people: 1, devices: 1 }, '')).toBe('Vai para 1 pessoa da Leal Mídia (1 aparelho).');
  });

  it('para a Leal Mídia com mais de uma pessoa diz quantas (o "Para mim" vai para todo o público)', () => {
    expect(pedidoDeDisparo('admin', { people: 3, devices: 5 }, '').titulo)
      .toBe('Enviar para 3 pessoas da Leal Mídia (5 aparelhos)?');
  });

  it('para um cliente: pessoas, aparelhos e o nome do cliente', () => {
    expect(pedidoDeDisparo('client', { people: 12, devices: 17 }, 'Moeda Forte').titulo)
      .toBe('Enviar para 12 pessoas (17 aparelhos) de Moeda Forte?');
    expect(textoDoPublico('client', { people: 1, devices: 1 }, 'Apto')).toBe('Vai para 1 pessoa (1 aparelho) de Apto.');
  });

  it('status do histórico só com cores do tema', () => {
    Object.values(STATUS_CLASS).forEach(c => expect(c).not.toMatch(/emerald|amber|red-|zinc|violet|#/));
  });
});
