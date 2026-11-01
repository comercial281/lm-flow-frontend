import { describe, expect, it, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const patch = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get, post, patch, delete: del } }));

import { salesAgentsService } from './salesAgentsService';

beforeEach(() => { get.mockReset(); post.mockReset(); patch.mockReset(); del.mockReset(); });

const NUMERO = {
  id: 'n1', inbox_id: 'i1', phone: '5511900000001', inbox_name: 'Número A', enabled: true, connected: true,
  voice: null, triggers: null, position: 0, owner_user_id: null, owner_name: null,
};

describe('números do agente', () => {
  it('criarNumero posta no endereço do agente e devolve o número com os avisos', async () => {
    post.mockResolvedValue({ data: { data: { ...NUMERO, warnings: ['Este número também é do agente B'] } } });
    const r = await salesAgentsService.criarNumero('a1', { inbox_id: 'i1' });
    expect(post).toHaveBeenCalledWith('/sales_agents/a1/numbers', { inbox_id: 'i1' });
    expect(r.id).toBe('n1');
    expect(r.warnings).toEqual(['Este número também é do agente B']);
  });

  it('criarNumero sem avisos no corpo devolve lista vazia', async () => {
    post.mockResolvedValue({ data: { data: NUMERO } });
    expect((await salesAgentsService.criarNumero('a1', { inbox_id: 'i1' })).warnings).toEqual([]);
  });

  it('atualizarNumero manda o nulo no corpo (triggers: null = herda do agente)', async () => {
    patch.mockResolvedValue({ data: { data: { ...NUMERO, warnings: [] } } });
    await salesAgentsService.atualizarNumero('a1', 'n1', { triggers: null });
    expect(patch).toHaveBeenCalledWith('/sales_agents/a1/numbers/n1', { triggers: null });
    const corpo = patch.mock.calls[0][1] as Record<string, unknown>;
    expect('triggers' in corpo && corpo.triggers === null).toBe(true);
  });

  it('atualizarNumero com lista vazia manda a lista vazia (sem gatilho)', async () => {
    patch.mockResolvedValue({ data: { data: { ...NUMERO, triggers: [], warnings: [] } } });
    await salesAgentsService.atualizarNumero('a1', 'n1', { triggers: [] });
    expect(patch).toHaveBeenCalledWith('/sales_agents/a1/numbers/n1', { triggers: [] });
  });

  it('tirarNumero apaga no endereço do número', async () => {
    del.mockResolvedValue({ data: {} });
    await salesAgentsService.tirarNumero('a1', 'n1');
    expect(del).toHaveBeenCalledWith('/sales_agents/a1/numbers/n1');
  });
});

describe('quadros, conhecimento de fábrica e link', () => {
  it('resumos lê o endereço dos quadros', async () => {
    const quadro = [{ id: 'a1', conversations: 4, handoffs: 1, median_reply_minutes: null, numbers: [{ inbox_id: 'i1', conversations: 4 }] }];
    get.mockResolvedValue({ data: { data: quadro } });
    expect(await salesAgentsService.resumos()).toEqual(quadro);
    expect(get).toHaveBeenCalledWith('/sales_agents/summaries');
  });

  it('resumos sem corpo devolve vazio', async () => {
    get.mockResolvedValue({ data: {} });
    expect(await salesAgentsService.resumos()).toEqual([]);
  });

  it('conhecimentosDeFabrica lê os tópicos do agente', async () => {
    const itens = [{ topic: 'mcmv', title: 'MCMV', body: 'Texto', reviewed_at: '2026-10-01', enabled: true, by_marks: true }];
    get.mockResolvedValue({ data: { data: itens } });
    expect(await salesAgentsService.conhecimentosDeFabrica('a1')).toEqual(itens);
    expect(get).toHaveBeenCalledWith('/sales_agents/a1/factory_knowledge');
  });

  it('criarLink pede o link do imóvel pelo código', async () => {
    get.mockResolvedValue({ data: { data: { link: 'https://x/AbC', message: 'Oi', number: '5511900000001', property: { id: 'p1', code: 'AB01', title: 'Residencial Teste' } } } });
    const r = await salesAgentsService.criarLink('a1', { property_code: 'AB01' });
    expect(get).toHaveBeenCalledWith('/sales_agents/a1/property_link', { params: { property_code: 'AB01' } });
    expect(r.link).toBe('https://x/AbC');
    expect(r.property?.code).toBe('AB01');
  });
});

describe('Minha ficha', () => {
  const FICHA = { id: 'n1', inbox_id: 'i1', phone: null, inbox_name: 'Número A', agent_id: 'a1', agent_name: 'Agente A', voice: null, house_voice: { kind: 'consultora', name: 'Ana' } };

  it('minhasFichas lê a lista do corretor dono', async () => {
    get.mockResolvedValue({ data: { data: [FICHA] } });
    expect(await salesAgentsService.minhasFichas()).toEqual([FICHA]);
    expect(get).toHaveBeenCalledWith('/sales_agent_numbers/own_fichas');
  });

  it('gravarMinhaFicha manda só name, gender e intro dentro de voice', async () => {
    patch.mockResolvedValue({ data: { data: FICHA } });
    await salesAgentsService.gravarMinhaFicha('n1', {
      name: 'Bia', gender: 'ela', intro: 'corretora', kind: 'corretor', triggers: [],
    } as never);
    expect(patch).toHaveBeenCalledWith('/sales_agent_numbers/n1/own_ficha', { voice: { name: 'Bia', gender: 'ela', intro: 'corretora' } });
  });

  it('gravarMinhaFicha só leva o que veio (campo ausente não vai)', async () => {
    patch.mockResolvedValue({ data: { data: FICHA } });
    await salesAgentsService.gravarMinhaFicha('n1', { intro: '' });
    expect(patch).toHaveBeenCalledWith('/sales_agent_numbers/n1/own_ficha', { voice: { intro: '' } });
  });
});

describe('lições: contador e origem', () => {
  const CONTADOR = {
    rules: { valendo: 3, pausadas: 1, fora_por_tamanho: 2, cabem: 40 },
    examples: { valendo: 5, pausadas: 0, fora_por_tamanho: 0, cabem: 20 },
  };

  it('lê meta.counter e traduz regras/exemplos', async () => {
    get.mockResolvedValue({ data: { data: [], meta: { limits: { per_kind: 40, conversations: 6 }, counter: CONTADOR } } });
    const r = await salesAgentsService.listLessons('a1');
    expect(r.contadores).toEqual({ regras: CONTADOR.rules, exemplos: CONTADOR.examples });
  });

  it('sem meta.counter, monta da lista (exemplo = bom + ruim; pausada e fora do prompt contam à parte)', async () => {
    get.mockResolvedValue({
      data: {
        data: [
          { id: '1', kind: 'rule', enabled: true, in_use: true },
          { id: '2', kind: 'rule', enabled: true, in_use: false },
          { id: '3', kind: 'rule', enabled: false, in_use: false },
          { id: '4', kind: 'good_example', enabled: true, in_use: true },
          { id: '5', kind: 'bad_example', enabled: true, in_use: true },
          { id: '6', kind: 'bad_example', enabled: false, in_use: false },
        ],
      },
    });
    const r = await salesAgentsService.listLessons('a1');
    expect(r.contadores.regras).toEqual({ valendo: 1, pausadas: 1, fora_por_tamanho: 1, cabem: 40 });
    expect(r.contadores.exemplos).toEqual({ valendo: 2, pausadas: 1, fora_por_tamanho: 0, cabem: 20 });
  });

  it('traduz o origin antigo na leitura (manual vira equipe, suggestion vira sugestao)', async () => {
    get.mockResolvedValue({
      data: { data: [
        { id: '1', kind: 'rule', origin: 'manual' },
        { id: '2', kind: 'rule', origin: 'suggestion' },
        { id: '3', kind: 'rule', origin: 'correcao' },
        { id: '4', kind: 'rule', origin: 'sugestao' },
        { id: '5', kind: 'rule' },
      ] },
    });
    const { licoes } = await salesAgentsService.listLessons('a1');
    expect(licoes.map((l) => l.origin)).toEqual(['equipe', 'sugestao', 'correcao', 'sugestao', 'equipe']);
  });

  it('lição nova traz os campos do exemplo bom, com nulo onde não há', async () => {
    get.mockResolvedValue({ data: { data: [{ id: '1', kind: 'good_example', topic: 'preco', bad_content: 'ruim', why: 'porque' }, { id: '2', kind: 'rule' }] } });
    const { licoes } = await salesAgentsService.listLessons('a1');
    expect(licoes[0]).toMatchObject({ topic: 'preco', bad_content: 'ruim', why: 'porque' });
    expect(licoes[1]).toMatchObject({ topic: null, bad_content: null, why: null });
  });
});
