import { describe, expect, it } from 'vitest';
import { estadoNoCartao, resumoDaMudanca, situacaoDoSite } from './situacaoDoSite';

const agora = new Date('2026-10-14T15:00:00-03:00');
const base = { configured: true, state: 'ok' as const, last_count: 220, last_checked_at: '2026-10-14T14:00:00-03:00' };

describe('situacaoDoSite', () => {
  it('lendo: verde, com a última leitura e quantos imóveis', () => {
    expect(situacaoDoSite(base, agora)).toEqual({ chave: 'ok', rotulo: 'Lendo', selo: 'success', detalhe: 'Última leitura há 1 h · 220 imóveis' });
  });
  it('esperando a 1ª leitura', () => {
    expect(situacaoDoSite({ ...base, state: 'waiting', last_checked_at: null }, agora))
      .toMatchObject({ rotulo: 'Lendo pela primeira vez', selo: 'warning' });
  });
  it('arquivo com problema: laranja, com o motivo', () => {
    expect(situacaoDoSite({ ...base, state: 'problem', last_error: 'O arquivo veio vazio.' }, agora))
      .toEqual({ chave: 'problem', rotulo: 'Arquivo com problema', selo: 'warning', detalhe: 'O arquivo veio vazio. Nenhum imóvel foi inativado.' });
  });
  it('parou de ler: vermelho, com o motivo', () => {
    expect(situacaoDoSite({ ...base, state: 'stopped', last_error: 'o site demorou demais pra responder' }, agora))
      .toMatchObject({ rotulo: 'Parou de ler', selo: 'error', detalhe: 'Motivo: o site demorou demais pra responder' });
  });
  it('desligado e não configurado', () => {
    expect(situacaoDoSite({ ...base, state: 'off', enabled: false }, agora)).toMatchObject({ rotulo: 'Desligado', selo: 'inactive' });
    expect(situacaoDoSite({ configured: false, state: 'off' }, agora)).toMatchObject({ rotulo: 'Não configurado', detalhe: '' });
  });
});

describe('resumo e cartão', () => {
  it('resumo da última mudança', () => {
    expect(resumoDaMudanca({ create: 3, update: 5, inactivate: 1, reactivate: 0, unchanged: 200 })).toBe('3 novos · 5 atualizados · 1 saiu');
    expect(resumoDaMudanca({ create: 1, reactivate: 2 })).toBe('1 novo · 2 voltaram');
    expect(resumoDaMudanca({ unchanged: 3, warnings: [{ key: 'x' }] })).toBeNull();
    expect(resumoDaMudanca(undefined)).toBeNull();
  });
  it('estado no cartão de Sistemas', () => {
    expect(estadoNoCartao(base)).toBe('Lendo · 220 imóveis');
    expect(estadoNoCartao({ configured: false, state: 'off' })).toBe('Não configurado');
    expect(estadoNoCartao({ ...base, state: 'stopped' })).toBe('Parou de ler');
  });
});
