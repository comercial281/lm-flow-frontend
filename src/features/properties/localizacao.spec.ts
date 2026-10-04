import { describe, expect, it } from 'vitest';
import { alfinetePodePular, cepCompleto, podeProcurarPonto, textoDoPonto } from './localizacao';

describe('localizacao', () => {
  it('texto por precisão e origem', () => {
    expect(textoDoPonto('number', 'auto')).toBe('Achamos pelo endereço. Arraste o alfinete se precisar ajustar.');
    expect(textoDoPonto('street', 'auto')).toBe('Não achamos o número exato, mostramos a rua. Arraste até o imóvel.');
    expect(textoDoPonto('city', 'auto')).toBe('Não achamos o endereço. Arraste o alfinete até o imóvel.');
    expect(textoDoPonto(null, null)).toBe('Não achamos o endereço. Arraste o alfinete até o imóvel.');
    expect(textoDoPonto('number', 'manual')).toBe('Posição ajustada à mão.');
  });
  it('CEP com hífen, espaço ou incompleto', () => {
    expect([cepCompleto('13015-002'), cepCompleto(' 13015 002 '), cepCompleto('1301500'), cepCompleto(null)])
      .toEqual(['13015002', '13015002', null, null]);
  });
  it('só procura ponto com cidade e mais alguma coisa', () => {
    expect(podeProcurarPonto({ address_city: 'Campinas', address_street: 'Rua A' })).toBe(true);
    expect(podeProcurarPonto({ address_city: 'Campinas', address_zip: '13015-002' })).toBe(true);
    expect(podeProcurarPonto({ address_city: 'Campinas' })).toBe(false);
    expect(podeProcurarPonto({ address_street: 'Rua A' })).toBe(false);
  });
  it('alfinete arrastado à mão não pula', () => {
    expect([alfinetePodePular('manual'), alfinetePodePular('auto'), alfinetePodePular(null)]).toEqual([false, true, true]);
  });
});
