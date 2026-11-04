import { describe, expect, it } from 'vitest';
import { frasesDoLeadBarrado, semNomeDeCampanha, sugestaoPeloNome, ultimoLeadEmTexto } from './telaDeCampanhas';

describe('frasesDoLeadBarrado', () => {
  it('servidor antigo (sem recent_count): só a contagem', () => {
    expect(frasesDoLeadBarrado({ lead_count: 4 })).toEqual({ principal: '4 leads esperando', porImportacao: null });
    expect(frasesDoLeadBarrado({ lead_count: 1 }).principal).toBe('1 lead esperando');
  });
  it('separa o que entra sozinho do que só entra por importação', () => {
    expect(frasesDoLeadBarrado({ lead_count: 5, recent_count: 3 })).toEqual({ principal: '3 leads entram sozinhos ao plugar', porImportacao: '2 leads só entram por importação manual' });
    expect(frasesDoLeadBarrado({ lead_count: 1, recent_count: 1 })).toEqual({ principal: '1 lead entra sozinho ao plugar', porImportacao: null });
  });
  it('quem não importa: a frase da importação termina mandando pro suporte da LM', () => {
    expect(frasesDoLeadBarrado({ lead_count: 5, recent_count: 3 }, true).porImportacao).toBe('2 leads só entram por importação manual: peça pro suporte da LM');
    expect(frasesDoLeadBarrado({ lead_count: 6, recent_count: 0 }, true).porImportacao).toBe('Só entram por importação manual: peça pro suporte da LM');
  });
  it('tudo velho: só importação', () => {
    expect(frasesDoLeadBarrado({ lead_count: 6, recent_count: 0 })).toEqual({ principal: '6 leads esperando', porImportacao: 'Só entram por importação manual' });
  });
});

describe('o resto', () => {
  it('semNomeDeCampanha só vale para anúncio sem título nem campanha', () => {
    expect(semNomeDeCampanha({ kind: 'ad', ad_title: null, campaign_name: ' ' })).toBe(true);
    expect(semNomeDeCampanha({ kind: 'ad', ad_title: 'X', campaign_name: null })).toBe(false);
    expect(semNomeDeCampanha({ kind: 'campaign', ad_title: null, campaign_name: null })).toBe(false);
  });
  it('último lead em frase; sem data, sem frase', () => {
    const agora = new Date('2026-11-04T12:00:00Z');
    expect(ultimoLeadEmTexto('2026-11-01T12:00:00Z', agora)).toBe('Último lead há 3 dias');
    expect(ultimoLeadEmTexto(null)).toBeNull();
  });
  it('sugestão pelo nome tira data e símbolo', () => {
    expect(sugestaoPeloNome('[03/11] [CASTELO 2.0]')).toBe('CASTELO');
    expect(sugestaoPeloNome('[27/05] [CAPRI 2.0] [+ INT] [COND]')).toBe('CAPRI');
    expect(sugestaoPeloNome('')).toBeNull();
  });
});
