import { describe, expect, it } from 'vitest';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import {
  addBranch, branchesOf, percentTotal, percentProblem, removeBranch, setBranchPercent, splitEvenly, summary,
} from './randomizer';
import { nodeProblem } from './readiness';
import { foraDoFunilDeConversa, freshBlockConfig, paletteItems } from './palette';
import { personalBlockState } from './personal';
import { numberWarnings } from './numberWarnings';
import { removeAndRewire } from './guide';
import {
  branchHandles, buildEdges, buildSaveFlowPayload, calculateLayout, cutEdge, insertAt, link, looseOutputs, outputLabel, outputSide,
  pathHandle, removeNode, type OutputHandle,
} from '@/lib/flowAutomationGraph';

const node = (over: Partial<FlowAutomationNode>): FlowAutomationNode => ({
  id: 'n1', kind: 'send_whatsapp', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
  pos_x: null, pos_y: null, steps: [], ...over,
});

const sorteio = (paths: Array<[string, number, string | null]>, id = 'r') =>
  node({ id, kind: 'randomizer', config: { branches: paths.map(([bid, percent, next]) => ({ id: bid, percent, next_node_id: next })) } });

describe('caminhos do Randomizador', () => {
  it('a divisão igual fecha 100%, com a sobra nos primeiros', () => {
    expect(splitEvenly([{ id: 'a' }, { id: 'b' }, { id: 'c' }]).map(b => b.percent)).toEqual([34, 33, 33]);
    expect(splitEvenly([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]).map(b => b.percent)).toEqual([25, 25, 25, 25]);
  });

  it('o bloco novo nasce com 2 caminhos, 50% cada', () => {
    const item = paletteItems().find(i => i.kind === 'randomizer');
    expect(item?.label).toBe('Randomizador');
    expect(item?.group).toBe('control');
    expect(branchesOf(item!.config).map(b => b.percent)).toEqual([50, 50]);
  });

  it('cada bloco novo tem seus próprios ids de caminho', () => {
    const item = paletteItems().find(i => i.kind === 'randomizer')!;
    const ids = [...branchesOf(freshBlockConfig(item.config)), ...branchesOf(freshBlockConfig(item.config))].map(b => b.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('adicionar e remover redividem igual e guardam a ligação de quem fica', () => {
    const config = { branches: [{ id: 'a', percent: 70, next_node_id: 'x' }, { id: 'b', percent: 30, next_node_id: 'y' }] };
    const plus = addBranch(config);
    expect(branchesOf(plus).map(b => b.percent)).toEqual([34, 33, 33]);
    expect(branchesOf(plus).map(b => b.next_node_id)).toEqual(['x', 'y', null]);
    const minus = removeBranch(plus, 'b');
    expect(branchesOf(minus).map(b => [b.id, b.percent, b.next_node_id])).toEqual([['a', 50, 'x'], [branchesOf(plus)[2].id, 50, null]]);
  });

  it('para em 10 caminhos e não tira abaixo de 2', () => {
    const ten = { branches: Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, percent: 10, next_node_id: null })) };
    expect(branchesOf(addBranch(ten))).toHaveLength(10);
    const two = { branches: [{ id: 'a', percent: 50, next_node_id: null }, { id: 'b', percent: 50, next_node_id: null }] };
    expect(branchesOf(removeBranch(two, 'a'))).toHaveLength(2);
  });

  it('digitar a % não mexe nas outras e aceita só inteiro de 0 a 100', () => {
    const config = { branches: [{ id: 'a', percent: 50, next_node_id: null }, { id: 'b', percent: 50, next_node_id: null }] };
    expect(branchesOf(setBranchPercent(config, 'a', '70')).map(b => b.percent)).toEqual([70, 50]);
    expect(branchesOf(setBranchPercent(config, 'a', '250'))[0].percent).toBe(100);
    expect(branchesOf(setBranchPercent(config, 'a', ''))[0].percent).toBe(0);
    expect(branchesOf(setBranchPercent(config, 'a', '12.7'))[0].percent).toBe(12);
  });

  it('o aviso da soma diz o que falta ou o que sobra', () => {
    const with_ = (a: number, b: number) => ({ branches: [{ id: 'a', percent: a, next_node_id: null }, { id: 'b', percent: b, next_node_id: null }] });
    expect(percentTotal(with_(60, 30))).toBe(90);
    expect(percentProblem(with_(50, 50))).toBeNull();
    expect(percentProblem(with_(60, 30))).toBe('Faltam 10% pra fechar 100%.');
    expect(percentProblem(with_(60, 50))).toBe('Passou 10% dos 100%.');
  });

  it('a janela não salva e o cartão avisa quando a soma não fecha', () => {
    const block = { kind: 'randomizer' as const, config: { branches: [{ id: 'a', percent: 60 }, { id: 'b', percent: 30 }] } };
    expect(nodeProblem(block)).toBe('Faltam 10% pra fechar 100%.');
    expect(nodeProblem({ kind: 'randomizer', config: { branches: [{ id: 'a', percent: 60 }, { id: 'b', percent: 40 }] } })).toBeNull();
  });

  it('a frase do cartão conta os caminhos', () => {
    expect(summary({ branches: [{ id: 'a', percent: 50 }, { id: 'b', percent: 50 }] })).toBe('Sorteia 1 de 2 caminhos pra cada lead.');
  });

  it('duplicar o bloco: ids novos, nada ligado e a mesma %', () => {
    const copy = freshBlockConfig({ branches: [{ id: 'a', percent: 70, next_node_id: 'x' }, { id: 'b', percent: 30, next_node_id: 'y' }] });
    const branches = branchesOf(copy);
    expect(branches.map(b => b.percent)).toEqual([70, 30]);
    expect(branches.map(b => b.next_node_id)).toEqual([null, null]);
    expect(branches.map(b => b.id)).not.toContain('a');
  });

  it('fica fora do funil de mensagem, que roda em linha reta, sem mexer nos outros blocos', () => {
    const items = paletteItems();
    const noFunil = foraDoFunilDeConversa();
    expect(noFunil(items.find(i => i.kind === 'randomizer')!)).toBe('fora');
    expect(noFunil(items.find(i => i.kind === 'condition')!)).toBe('ok');
    expect(foraDoFunilDeConversa(() => 'indisponivel')(items.find(i => i.kind === 'wait')!)).toBe('indisponivel');
  });

  it('o corretor com Automações próprias vê o bloco', () => {
    const item = paletteItems().find(i => i.kind === 'randomizer')!;
    expect(personalBlockState(item, { temNumero: true, temIA: false })).toBe('ok');
  });
});

describe('Randomizador no mapa', () => {
  const r = sorteio([['a', 25, 'x'], ['b', 75, null]]);
  const x = node({ id: 'x' });
  const a = pathHandle('a');
  const b = pathHandle('b');

  it('tem uma saída por caminho, todas pela direita', () => {
    expect(branchHandles(r)).toEqual([a, b]);
    expect(branchHandles(r).map(h => outputSide(r, h))).toEqual(['right', 'right']);
  });

  it('a saída leva a letra e a %', () => {
    expect(outputLabel(r, a)).toBe('Caminho A · 25%');
    expect(outputLabel(r, b)).toBe('Caminho B · 75%');
    expect(outputLabel(node({ kind: 'condition' }), 'yes')).toBe('Sim');
  });

  it('só desenha linha do caminho ligado, com a letra e a %', () => {
    const edges = buildEdges([r, x], null);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ id: `r:${a}`, source: 'r', target: 'x', sourceHandle: a, label: 'A · 25%', deletable: true });
  });

  it('ligar, cortar e saber qual saída está livre', () => {
    expect(looseOutputs(r)).toEqual([b]);
    const linked = link([r, x], 'r', b, 'x');
    expect(looseOutputs(linked[0])).toEqual([]);
    const cut = cutEdge(linked, `r:${b}`);
    expect(looseOutputs(cut[0])).toEqual([b]);
  });

  it('o "+" na saída ligada encaixa o bloco no meio', () => {
    const fresh = node({ id: 'novo' });
    const result = insertAt([r, x], { id: 'r', handle: a }, fresh);
    expect(branchesOf(result[0].config)[0].next_node_id).toBe('novo');
    expect(result.find(n => n.id === 'novo')?.next_node_id).toBe('x');
  });

  it('o Randomizador novo encaixado no meio segura o resto no Caminho A', () => {
    const fresh = sorteio([['p', 50, null], ['q', 50, null]], 'novo');
    const result = insertAt([node({ id: 'm', next_node_id: 'x' }), x], { id: 'm', handle: 'out' }, fresh);
    expect(branchesOf(result.find(n => n.id === 'novo')!.config)[0].next_node_id).toBe('x');
  });

  it('excluir o bloco de destino esvazia o caminho', () => {
    const [kept] = removeNode([r, x], 'x');
    expect(branchesOf(kept.config)[0].next_node_id).toBeNull();
  });

  it('tirar uma mensagem no modo guiado religa o caminho', () => {
    const msg = node({ id: 'x', next_node_id: 'y' });
    const out = removeAndRewire([r, msg, node({ id: 'y' })], 'r', 'x');
    expect(branchesOf(out.nodes[0].config)[0].next_node_id).toBe('y');
  });

  it('o Organizar empilha os destinos na coluna seguinte, um por linha', () => {
    const three = sorteio([['a', 34, 'x'], ['b', 33, 'y'], ['c', 33, 'z']]);
    const layout = calculateLayout([three, node({ id: 'x' }), node({ id: 'y' }), node({ id: 'z' })], 'r');
    expect(new Set(['x', 'y', 'z'].map(id => layout[id].x))).toEqual(new Set([layout.x.x]));
    expect(layout.x.x).toBeGreaterThan(layout.r.x);
    expect(layout.x.y).toBeLessThan(layout.y.y);
    expect(layout.y.y).toBeLessThan(layout.z.y);
  });

  it('o Organizar reserva o espaço do cartão alto: o próximo bloco da coluna não encosta', () => {
    const paths = Array.from({ length: 10 }, (_, i): [string, number, string | null] => [`c${i}`, 10, null]);
    const tall = sorteio(paths);
    const layout = calculateLayout([tall, node({ id: 'solto' })], 'r');
    expect(layout.solto.y - layout.r.y).toBeGreaterThanOrEqual(120 + 10 * 32);
  });

  it('o salvar leva os caminhos na config e nenhuma saída nas colunas', () => {
    const payload = buildSaveFlowPayload([{ ...r, next_node_id: null }], 'r');
    expect(payload.nodes[0]).toMatchObject({ next_node_id: null, next_yes_node_id: null, next_no_node_id: null });
    expect(branchesOf(payload.nodes[0].config)).toHaveLength(2);
  });

  it('aviso de número enxerga a mensagem antes do Randomizador', () => {
    const hand = node({ id: 'ia', kind: 'hand_to_ai' });
    const msg = node({ id: 'm', kind: 'send_whatsapp', next_node_id: 'r' });
    const nodes = [msg, sorteio([['a', 100, 'ia'], ['b', 0, null]]), hand];
    const warnings = numberWarnings({
      trigger: { event: 'lead.created' } as never, nodes, initialNodeId: 'm',
      setting: { mode: 'conversation' } as never, inboxesWithAi: new Set(),
    });
    expect(warnings).toEqual([]);
  });

  it('o tipo aceita a saída de caminho', () => {
    const handle: OutputHandle = pathHandle('qualquer');
    expect(handle).toBe('path:qualquer');
  });
});
