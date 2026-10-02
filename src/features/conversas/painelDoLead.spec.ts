import { describe, expect, it } from 'vitest';
import {
  OUTRO_NUMERO, emOfertaParaQuemVe, mascararTelefone, nomeNaTela, origemDoLead, outraConversa,
  painelAoTrocarDeConversa, respostasDoFormulario, selosDoLead, textoOutraConversa,
} from './painelDoLead';

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

  it('"Ver anúncio" só para anúncio: landing, site e portal não levam link da origem gravada', () => {
    for (const source of ['landing', 'site', 'portal', 'utm', 'manual', 'bolsao', 'organic_whatsapp']) {
      expect(origemDoLead({ leadOrigin: { source, source_url: 'https://exemplo.com/pagina' } })?.link).toBeNull();
    }
    expect(
      origemDoLead({ leadOrigin: { source: 'meta_lead_ads', source_url: 'https://fb.me/form' } })?.link,
    ).toBe('https://fb.me/form');
    expect(
      origemDoLead({ leadOrigin: { source: 'anuncio', source_app: 'instagram', source_url: 'https://instagram.com/p/x' } }),
    ).toEqual({ rotulo: 'Anúncio no Instagram', link: 'https://instagram.com/p/x' });
  });

  it('o anúncio da conversa vale como link mesmo com outra origem gravada', () => {
    expect(
      origemDoLead({
        leadOrigin: { source: 'landing', source_url: 'https://exemplo.com/lp' },
        adReferral: { source_url: 'https://fb.me/anuncio' },
      }),
    ).toEqual({ rotulo: 'Landing Page', link: 'https://fb.me/anuncio' });
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

  it('prefere o nome que o gestor deu ao número (display_name), depois o nome da conversa', () => {
    const conversas = [
      { id: 'atual' },
      { id: 'c-2', inbox: { id: 'i9', name: 'whatsapp-marina-imoveis' }, last_activity_at: 10 },
    ];
    expect(outraConversa(conversas, 'atual', [{ id: 'i9', display_name: 'Marina' }])?.numero).toBe('Marina');
    expect(outraConversa(conversas, 'atual', [{ id: 'outro', display_name: 'X' }])?.numero).toBe(
      'whatsapp-marina-imoveis',
    );
    expect(outraConversa(conversas, 'atual', null)?.numero).toBe('whatsapp-marina-imoveis');
  });

  it('sem nome do número: "outro número"', () => {
    expect(outraConversa([{ id: 1 }, { id: 2, inbox: null }], 1)?.numero).toBe(OUTRO_NUMERO);
    expect(OUTRO_NUMERO).toBe('outro número');
  });

  it('texto da linha: com o nome do número, ou "por outro número" sem ele', () => {
    expect(textoOutraConversa('Marina')).toBe('Também conversou pelo número Marina');
    expect(textoOutraConversa(OUTRO_NUMERO)).toBe('Também conversou por outro número');
  });
});

describe('respostasDoFormulario — a seção recolhida', () => {
  it('junta personalizados e extras, com a chave legível', () => {
    expect(
      respostasDoFormulario({ renda_mensal: '5 mil' }, { cidade: 'Campinas' }),
    ).toEqual([
      { id: 'custom.renda_mensal', rotulo: 'Renda Mensal', valor: '5 mil' },
      { id: 'additional.cidade', rotulo: 'Cidade', valor: 'Campinas' },
    ]);
  });

  it('o mesmo filtro de vazios de antes: vazio, "null", objeto e "not informed" saem', () => {
    expect(
      respostasDoFormulario(
        { a: '', b: 'null', c: 'undefined', d: '  ', e: 'Not Informed', f: null, g: 0 },
        { ad_referral: { source_app: 'instagram' }, lead_origin: { source: 'portal' } },
      ),
    ).toEqual([]);
  });

  it('sem atributos: lista vazia', () => {
    expect(respostasDoFormulario(undefined, null)).toEqual([]);
  });
});

describe('emOfertaParaQuemVe', () => {
  it('sem dono e com oferta minha: em oferta', () => {
    expect(emOfertaParaQuemVe({ semDono: true, ofertasCarregadas: true, temOferta: true })).toBe(true);
  });

  it('sem dono, ofertas carregadas e nenhuma minha: não', () => {
    expect(emOfertaParaQuemVe({ semDono: true, ofertasCarregadas: true, temOferta: false })).toBe(false);
  });

  it('ofertas ainda não chegaram: lead sem dono conta como em oferta', () => {
    expect(emOfertaParaQuemVe({ semDono: true, ofertasCarregadas: false, temOferta: false })).toBe(true);
  });

  it('com dono: nunca', () => {
    expect(emOfertaParaQuemVe({ semDono: false, ofertasCarregadas: false, temOferta: false })).toBe(false);
    expect(emOfertaParaQuemVe({ semDono: false, ofertasCarregadas: true, temOferta: true })).toBe(false);
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

describe('painelAoTrocarDeConversa — o painel ao abrir outra conversa', () => {
  it('tela larga: abre sempre, mesmo depois do X', () => {
    expect(painelAoTrocarDeConversa(true, false)).toBe(true);
    expect(painelAoTrocarDeConversa(true, true)).toBe(true);
  });

  it('abaixo de 1280px: fica como estava (aberto segue aberto, fechado segue fechado)', () => {
    expect(painelAoTrocarDeConversa(false, true)).toBe(true);
    expect(painelAoTrocarDeConversa(false, false)).toBe(false);
  });
});

describe('nomeNaTela — nome que é o telefone, na oferta', () => {
  it('na oferta, nome que é o telefone sai mascarado (inclusive o JID)', () => {
    expect(nomeNaTela('+5511912345634', true)).toBe('(11) •••••-••34');
    expect(nomeNaTela('5511912345634@s.whatsapp.net', true)).toBe('(11) •••••-••34');
  });

  it('nome de verdade não muda, com ou sem oferta', () => {
    expect(nomeNaTela('Marcus Exemplo', true)).toBe('Marcus Exemplo');
    expect(nomeNaTela('Marcus Exemplo', false)).toBe('Marcus Exemplo');
  });

  it('fora da oferta, o telefone-nome vai como veio', () => {
    expect(nomeNaTela('+5511912345634', false)).toBe('+5511912345634');
  });

  it('sem nome: nada', () => {
    expect(nomeNaTela(null, true)).toBeNull();
    expect(nomeNaTela('', true)).toBe('');
  });
});

// Proposta B (02/10): a faixa de selos logo abaixo do nome. Cor só onde informa.
describe('selosDoLead — a faixa de selos do topo', () => {
  const funil = (id: string, nome: string, etapas: Array<{ id: string; name: string; color: string; position: number; comLead?: boolean }>) => ({
    id,
    name: nome,
    stages: etapas.map(e => ({ ...e, items: e.comLead ? [{ id: `item-${id}` }] : [] })),
  });

  const vendas = funil('f1', 'Funil de vendas', [
    { id: 'e1', name: 'Novo lead', color: '#2563eb', position: 0 },
    { id: 'e2', name: 'Primeiro contato', color: '#16a34a', position: 1, comLead: true },
  ]);
  const locacao = funil('f2', 'Locação', [{ id: 'e3', name: 'Visita marcada', color: '#d97706', position: 0, comLead: true }]);

  it('etapa do funil com a cor da etapa', () => {
    expect(selosDoLead({ pipelines: [vendas] })).toEqual([
      { tipo: 'etapa', id: 'etapa-f1', texto: 'Primeiro contato', cor: '#16a34a', funil: 'Funil de vendas' },
    ]);
  });

  it('lead em dois funis: um selo por funil', () => {
    const selos = selosDoLead({ pipelines: [vendas, locacao] });
    expect(selos.map(s => s.texto)).toEqual(['Primeiro contato', 'Visita marcada']);
    expect(selos.every(s => s.tipo === 'etapa')).toBe(true);
  });

  it('fora de funil (ou funil sem o lead em etapa nenhuma): sem selo de etapa', () => {
    expect(selosDoLead({ pipelines: [] })).toEqual([]);
    expect(selosDoLead({ pipelines: [funil('f3', 'Vazio', [{ id: 'e9', name: 'Nada', color: '#000', position: 0 }])] })).toEqual([]);
  });

  it('temperatura da IA vira Quente, Morno ou Frio', () => {
    expect(selosDoLead({ pipelines: [], temperatura: 'hot' })).toEqual([
      { tipo: 'temperatura', id: 'temperatura', texto: 'Quente', tom: 'quente' },
    ]);
    expect(selosDoLead({ pipelines: [], temperatura: 'warm' })[0]).toMatchObject({ texto: 'Morno', tom: 'morno' });
    expect(selosDoLead({ pipelines: [], temperatura: ' COLD ' })[0]).toMatchObject({ texto: 'Frio', tom: 'frio' });
  });

  it('sem temperatura (ou "unknown", a IA ainda não sabe): sem selo', () => {
    expect(selosDoLead({ pipelines: [], temperatura: null })).toEqual([]);
    expect(selosDoLead({ pipelines: [], temperatura: '' })).toEqual([]);
    expect(selosDoLead({ pipelines: [], temperatura: 'unknown' })).toEqual([]);
  });

  it('origem com o link do anúncio', () => {
    expect(selosDoLead({ pipelines: [], origem: { rotulo: 'Anúncio no Instagram', link: 'https://instagram.com/p/x' } })).toEqual([
      { tipo: 'origem', id: 'origem', texto: 'Anúncio no Instagram', link: 'https://instagram.com/p/x' },
    ]);
  });

  it('espera só quando esperaDoLead dá um texto', () => {
    expect(selosDoLead({ pipelines: [], espera: null })).toEqual([]);
    expect(selosDoLead({ pipelines: [], espera: 'sem resposta há 2 h' })).toEqual([
      { tipo: 'espera', id: 'espera', texto: 'sem resposta há 2 h' },
    ]);
  });

  it('ordem: etapa, temperatura, origem, espera', () => {
    const selos = selosDoLead({
      pipelines: [vendas, locacao],
      temperatura: 'warm',
      origem: { rotulo: 'Formulário Meta Ads', link: null },
      espera: 'sem resposta há 5 min',
    });
    expect(selos.map(s => s.tipo)).toEqual(['etapa', 'etapa', 'temperatura', 'origem', 'espera']);
  });
});
