import { describe, it, expect } from 'vitest';
import { resumoDaCota, situacaoDoPortal, tiposEmUso } from './situacao';
import type { PortalAdType } from '@/services/portals/portalsService';

/**
 * A situação do portal é UMA só (redesenho de 12/10/2026). Antes a lista mostrava
 * quatro sinais ao mesmo tempo e "AGUARDANDO" valia tanto pra quem nunca foi lido
 * quanto pra quem parou de ler há semanas — a Mais que Imóveis ficou 13 dias sem
 * leitura no Viva Real sem ninguém perceber.
 */
const agora = new Date('2026-10-12T15:00:00-03:00');

describe('situacaoDoPortal', () => {
  it('sem conexão: Não conectado, selo cinza, sem frase', () => {
    expect(situacaoDoPortal({ connected: false, active: false, last_accessed_at: null }, agora))
      .toEqual({ chave: 'nao_conectado', rotulo: 'Não conectado', selo: 'inactive', detalhe: '' });
  });

  it('conectado e lido nas últimas 48 h (o `active` do servidor): Recebendo, verde', () => {
    expect(situacaoDoPortal({ connected: true, active: true, last_accessed_at: '2026-10-12T13:00:00-03:00' }, agora))
      .toEqual({ chave: 'recebendo', rotulo: 'Recebendo', selo: 'success', detalhe: 'Leu o feed há 2 h' });
  });

  it('conectado, já leu, mas não nas últimas 48 h: Parou de ler, vermelho, com há quantos dias', () => {
    expect(situacaoDoPortal({ connected: true, active: false, last_accessed_at: '2026-09-29T17:15:20-03:00' }, agora))
      .toEqual({ chave: 'parou', rotulo: 'Parou de ler', selo: 'error', detalhe: 'Última leitura há 12 dias' });
  });

  it('conectado e nunca lido: Esperando 1ª leitura, laranja', () => {
    expect(situacaoDoPortal({ connected: true, active: false, last_accessed_at: null }, agora))
      .toEqual({ chave: 'esperando', rotulo: 'Esperando 1ª leitura', selo: 'warning', detalhe: 'O portal ainda não leu o feed' });
  });
});

const tipo = (key: string, label: string, limit: number | null, count: number): PortalAdType =>
  ({ key, label, feed_value: key.toUpperCase(), limit, count });

describe('tiposEmUso', () => {
  it('fica só o tipo com cota ou com imóvel; os zerados sem cota saem', () => {
    const lista = [
      tipo('standard', 'Padrão', 456, 351),
      tipo('premium', 'Destaque', 40, 40),
      tipo('super_premium', 'Super Destaque', null, 0),
      tipo('premiere_1', 'Destaque Exclusivo', 4, 4),
      tipo('triple', 'Destaque Triplo', null, 2),
    ];
    expect(tiposEmUso(lista).map(t => t.key)).toEqual(['standard', 'premium', 'premiere_1', 'triple']);
  });
});

describe('resumoDaCota', () => {
  it('tipos no limite viram uma frase só, em atenção', () => {
    expect(resumoDaCota([
      tipo('standard', 'Padrão', 456, 351),
      tipo('premium', 'Destaque', 40, 40),
      tipo('premiere_1', 'Destaque Exclusivo', 4, 4),
    ])).toEqual({ texto: 'Destaque e Destaque Exclusivo no limite', tom: 'atencao' });
  });

  it('acima da cota manda na frase e vira erro', () => {
    expect(resumoDaCota([
      tipo('standard', 'Padrão', 456, 351),
      tipo('premium', 'Destaque', 40, 41),
      tipo('premiere_1', 'Destaque Exclusivo', 4, 4),
    ])).toEqual({ texto: 'Destaque acima da cota', tom: 'erro' });
  });

  it('três nomes: vírgula e "e"', () => {
    expect(resumoDaCota([
      tipo('a', 'A', 1, 1), tipo('b', 'B', 1, 1), tipo('c', 'C', 1, 1),
    ])?.texto).toBe('A, B e C no limite');
  });

  it('um tipo só com cota e folga: "N de M"', () => {
    expect(resumoDaCota([tipo('standard', 'Normal', 500, 395)]))
      .toEqual({ texto: '395 de 500', tom: 'neutro' });
  });

  it('vários tipos com cota e todos com folga: "Dentro da cota"', () => {
    expect(resumoDaCota([tipo('standard', 'Padrão', 456, 10), tipo('premium', 'Destaque', 40, 3)]))
      .toEqual({ texto: 'Dentro da cota', tom: 'neutro' });
  });

  it('sem cota nenhuma: nada a dizer', () => {
    expect(resumoDaCota([tipo('standard', 'Padrão', null, 12)])).toBeNull();
    expect(resumoDaCota([])).toBeNull();
  });
});
