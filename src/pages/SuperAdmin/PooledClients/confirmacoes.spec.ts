import { describe, it, expect } from 'vitest';
import { pedidoArquivar, pedidoCongelar, pedidoDesligarMenu, pedidoRemoverPessoa } from './confirmacoes';

const t = { name: '016 Imóveis' };

describe('confirmações', () => {
  it('congelar diz o efeito real (login continua)', () => {
    const p = pedidoCongelar(t);
    expect(p.titulo).toBe('Congelar 016 Imóveis?');
    expect(p.descricao).toBe('As automações e o WhatsApp de 016 Imóveis param até descongelar. As pessoas continuam entrando no CRM.');
    expect(p.rotuloDaAcao).toBe('Congelar');
  });

  it('arquivar', () => {
    expect(pedidoArquivar(t).descricao).toBe(
      'Ele sai da lista e das contas da Visão Geral, e as automações e o WhatsApp param. Dá pra desarquivar depois.');
  });

  it('desligar menu inteiro diz quantas pessoas', () => {
    const p = pedidoDesligarMenu('Disparos', 9, '016 Imóveis');
    expect(p.titulo).toBe('Desligar Disparos?');
    expect(p.descricao).toBe('O menu some para as 9 pessoas de 016 Imóveis.');
    expect(p.destrutivo).toBe(true);
  });

  it('remover pessoa', () => {
    expect(pedidoRemoverPessoa('ana@x.com').titulo).toBe('Remover ana@x.com?');
  });
});
