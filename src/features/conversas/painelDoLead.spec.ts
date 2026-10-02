import { describe, expect, it } from 'vitest';
import { OUTRO_NUMERO, mascararTelefone, origemDoLead, outraConversa } from './painelDoLead';

// Regras do topo do painel do lead em Conversas (Fase 4, 02/10).

describe('origemDoLead — a linha "Veio de"', () => {
  it('formulário do Meta usa o rótulo do card do lead, sem o emoji', () => {
    expect(origemDoLead({ leadOrigin: { source: 'meta_lead_ads' } })).toEqual({
      rotulo: 'Formulário Meta Ads',
      link: null,
    });
  });

  it('portal leva o nome do portal', () => {
    expect(origemDoLead({ leadOrigin: { source: 'portal', portal: 'ZAP' } })?.rotulo).toBe('Portal · ZAP');
  });

  it('site leva o nome do site', () => {
    expect(origemDoLead({ leadOrigin: { source: 'site', site: 'Imobiliária Exemplo' } })?.rotulo).toBe(
      'Site · Imobiliária Exemplo',
    );
  });

  it('sem origem gravada mas com anúncio na conversa: "Anúncio no Instagram" com o link', () => {
    expect(
      origemDoLead({
        leadOrigin: null,
        adReferral: { source_app: 'instagram', source_url: 'https://instagram.com/p/exemplo' },
      }),
    ).toEqual({ rotulo: 'Anúncio no Instagram', link: 'https://instagram.com/p/exemplo' });
  });

  it('anúncio sem plataforma informada conta como Facebook', () => {
    expect(origemDoLead({ adReferral: { title: 'Lançamento' } })).toEqual({
      rotulo: 'Anúncio no Facebook',
      link: null,
    });
  });

  it('link do anúncio também vem da origem gravada', () => {
    expect(
      origemDoLead({ leadOrigin: { source: 'whatsapp_ctwa', source_url: 'https://fb.me/exemplo' } }),
    ).toEqual({ rotulo: 'WhatsApp Direto (CTWA)', link: 'https://fb.me/exemplo' });
  });

  it('origem não identificada: a linha não aparece', () => {
    expect(origemDoLead({ leadOrigin: { source: 'unknown' } })).toBeNull();
  });

  it('tudo vazio: a linha não aparece', () => {
    expect(origemDoLead({})).toBeNull();
    expect(origemDoLead({ leadOrigin: null, adReferral: null })).toBeNull();
    expect(origemDoLead({ leadOrigin: {}, adReferral: {} })).toBeNull();
  });
});

describe('outraConversa — a linha "Também conversou pelo número"', () => {
  it('só a conversa aberta: nada', () => {
    expect(outraConversa([{ id: 10, inbox: { name: 'Marina' } }], 10)).toBeNull();
    expect(outraConversa([], 10)).toBeNull();
  });

  it('atual + 2 outras: a mais recente, com +1', () => {
    const conversas = [
      { id: 'c-atual', inbox: { name: 'Plantão' }, last_activity_at: 1_790_000_900 },
      { id: 'c-velha', inbox: { name: 'Guatemala' }, last_activity_at: 1_790_000_100 },
      { id: 'c-nova', inbox: { name: 'Marina' }, last_activity_at: 1_790_000_500 },
    ];
    expect(outraConversa(conversas, 'c-atual')).toEqual({ id: 'c-nova', numero: 'Marina', mais: 1 });
  });

  it('compara o id como texto (a tela guarda número ou texto)', () => {
    expect(outraConversa([{ id: 7 }, { id: 8, inbox: { name: 'Marina' } }], '7')).toEqual({
      id: '8',
      numero: 'Marina',
      mais: 0,
    });
  });

  it('sem nome do número: "outro número"', () => {
    expect(outraConversa([{ id: 1 }, { id: 2, inbox: null }], 1)?.numero).toBe(OUTRO_NUMERO);
    expect(OUTRO_NUMERO).toBe('outro número');
  });
});

describe('mascararTelefone — oferta da roleta aberta', () => {
  it('mantém o DDD e os 2 últimos dígitos', () => {
    expect(mascararTelefone('+5511912345634')).toBe('(11) •••••-••34');
  });

  it('fixo com 8 dígitos', () => {
    expect(mascararTelefone('1132345678')).toBe('(11) ••••-••78');
  });

  it('vazio ou nulo: nada', () => {
    expect(mascararTelefone(null)).toBeNull();
    expect(mascararTelefone(undefined)).toBeNull();
    expect(mascararTelefone('  ')).toBeNull();
  });

  it('número de fora do Brasil também sai mascarado', () => {
    expect(mascararTelefone('+1 555 123 4567')).toBe('+• ••• ••• ••67');
  });
});
