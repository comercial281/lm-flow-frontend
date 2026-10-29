import { describe, it, expect } from 'vitest';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { calculateLayout, outputSide, targetSide, NODE_WIDTH } from './flowAutomationGraph';

const node = (id: string, kind: FlowAutomationNode['kind'], patch: Partial<FlowAutomationNode> = {}): FlowAutomationNode => ({
  id, kind, label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
  pos_x: null, pos_y: null, steps: [],
  ...patch,
});
const msg = (id: string, next: string | null) => node(id, 'send_whatsapp', { next_node_id: next });
const wait = (id: string, yes: string | null, no: string | null) => node(id, 'wait_for_reply', { config: { minutes: 60 }, next_yes_node_id: yes, next_no_node_id: no });
const cond = (id: string, yes: string | null, no: string | null) => node(id, 'condition', { next_yes_node_id: yes, next_no_node_id: no });

// O Follow-up padrão (o da Basel, 29/10/2026): 6 condições de retomada em
// cascata, 6 mensagens com espera entre elas, e todo "Respondeu" no Recuperado.
function followUpPadrao(): FlowAutomationNode[] {
  return [
    cond('ja', 'fim', 'c6'),
    cond('c6', 'e5', 'c5'),
    cond('c5', 'e4', 'c4'),
    cond('c4', 'e3', 'c3'),
    cond('c3', 'e2', 'c2'),
    cond('c2', 'e1', 'm1'),
    msg('m1', 'e1'), wait('e1', 'rec', 'm2'),
    msg('m2', 'e2'), wait('e2', 'rec', 'm3'),
    msg('m3', 'e3'), wait('e3', 'rec', 'm4'),
    msg('m4', 'e4'), wait('e4', 'rec', 'm5'),
    msg('m5', 'e5'), wait('e5', 'rec', 'm6'),
    msg('m6', 'fim'),
    node('fim', 'lead_action'),
    node('rec', 'followup_recovered', { next_node_id: 'mov' }),
    node('mov', 'move_stage'),
  ];
}

describe('Organizar: o caminho do lead corre reto, da esquerda pra direita', () => {
  it('uma sequência simples fica numa linha só', () => {
    const pos = calculateLayout([msg('a', 'b'), msg('b', 'c'), msg('c', null)], 'a');
    expect(pos.a.y).toBe(pos.b.y);
    expect(pos.b.y).toBe(pos.c.y);
    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.b.x).toBeLessThan(pos.c.x);
  });

  it('na espera, "Não respondeu" segue reto e "Respondeu" desce', () => {
    const pos = calculateLayout([wait('w', 'r', 'n'), msg('r', null), msg('n', null)], 'w');
    expect(pos.n.y).toBe(pos.w.y);
    expect(pos.n.x).toBeGreaterThan(pos.w.x);
    expect(pos.r.y).toBeGreaterThan(pos.w.y);
  });

  it('na condição, "Sim" segue reto e "Não" desce logo embaixo dela', () => {
    const pos = calculateLayout([cond('c', 's', 'n'), msg('s', null), msg('n', null)], 'c');
    expect(pos.s.y).toBe(pos.c.y);
    expect(pos.s.x).toBeGreaterThan(pos.c.x);
    expect(pos.n.x).toBe(pos.c.x);
    expect(pos.n.y).toBeGreaterThan(pos.c.y);
  });
});

describe('Organizar o Follow-up padrão', () => {
  const pos = calculateLayout(followUpPadrao(), 'ja');
  const mainLine = ['m1', 'e1', 'm2', 'e2', 'm3', 'e3', 'm4', 'e4', 'm5', 'e5', 'm6', 'fim'];

  it('as condições de retomada empilham numa coluna, com a Mensagem 1 embaixo', () => {
    const column = ['ja', 'c6', 'c5', 'c4', 'c3', 'c2', 'm1'];
    column.forEach(id => expect(pos[id].x).toBe(pos.ja.x));
    column.slice(1).forEach((id, i) => expect(pos[id].y).toBeGreaterThan(pos[column[i]].y));
  });

  it('as mensagens e esperas ficam numa linha reta, em ordem, até o encerrado', () => {
    mainLine.forEach(id => expect(pos[id].y).toBe(pos.m1.y));
    mainLine.slice(1).forEach((id, i) => expect(pos[id].x).toBeGreaterThan(pos[mainLine[i]].x));
  });

  it('o Recuperado fica embaixo da linha, depois da última espera que chega nele', () => {
    expect(pos.rec.y).toBeGreaterThan(pos.m1.y);
    expect(pos.rec.x).toBeGreaterThan(pos.e5.x);
    expect(pos.mov.y).toBe(pos.rec.y);
    expect(pos.mov.x).toBeGreaterThan(pos.rec.x);
  });

  it('nenhum bloco fica em cima de outro', () => {
    const spots = Object.values(pos).map(p => `${p.x}:${p.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });
});

describe('Organizar uma automação comum', () => {
  // Boas-vindas → espera (Respondeu: IA; Não respondeu: lembrete) → condição
  // (Sim: etiqueta; Não: tarefa) → os dois caminhos se juntam no fechamento.
  const nodes = [
    msg('boas', 'espera'),
    wait('espera', 'ia', 'lembrete'),
    node('ia', 'hand_to_ai'),
    msg('lembrete', 'veio'),
    cond('veio', 'etiqueta', 'tarefa'),
    node('etiqueta', 'add_label', { next_node_id: 'fecha' }),
    node('tarefa', 'create_task', { next_node_id: 'fecha' }),
    msg('fecha', null),
  ];
  const pos = calculateLayout(nodes, 'boas');

  it('o desvio desce uma linha só, quando ela está livre', () => {
    expect(pos.ia.y).toBe(pos.tarefa.y);
    expect(pos.ia.y).toBeGreaterThan(pos.espera.y);
  });

  it('onde dois caminhos se juntam, o bloco segue a linha de quem chega mais perto', () => {
    expect(pos.fecha.y).toBe(pos.etiqueta.y);
    expect(pos.fecha.x).toBeGreaterThan(pos.etiqueta.x);
  });
});

describe('Organizar fluxo fora do padrão', () => {
  it('bloco solto (sem ligação com o Início) não some: fica embaixo do resto', () => {
    const pos = calculateLayout([msg('a', 'b'), msg('b', null), msg('solto', null)], 'a');
    expect(pos.solto.y).toBeGreaterThan(pos.a.y);
  });

  it('um bloco que volta pra trás não trava o desenho', () => {
    const pos = calculateLayout([msg('a', 'b'), wait('b', 'a', 'c'), msg('c', null)], 'a');
    expect(Object.keys(pos).sort()).toEqual(['a', 'b', 'c']);
    expect(pos.c.x).toBeGreaterThan(pos.b.x);
  });

  it('condição com o "Não" apontando pro mesmo bloco da linha principal não empilha em cima dele', () => {
    const pos = calculateLayout([cond('c', 'a', 'b'), msg('a', 'b'), msg('b', null)], 'c');
    const spots = Object.values(pos).map(p => `${p.x}:${p.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });
});

describe('De que lado do bloco sai cada linha', () => {
  it('"Não" da condição e "Respondeu" da espera saem por baixo; o resto pela direita', () => {
    expect(outputSide(cond('c', null, null), 'no')).toBe('bottom');
    expect(outputSide(cond('c', null, null), 'yes')).toBe('right');
    expect(outputSide(wait('w', null, null), 'yes')).toBe('bottom');
    expect(outputSide(wait('w', null, null), 'no')).toBe('right');
    expect(outputSide(msg('m', null), 'out')).toBe('right');
  });

  it('espera "Sem limite" (só Respondeu) sai pela direita, porque é o caminho que segue', () => {
    const indefinite = node('w', 'wait_for_reply', { config: { indefinite: true } });
    expect(outputSide(indefinite, 'yes')).toBe('right');
  });
});

describe('Por onde a linha entra no bloco', () => {
  const at = (x: number, y: number) => ({ x, y });

  it('saindo por baixo, pro bloco logo embaixo: entra por cima', () => {
    expect(targetSide('bottom', at(0, 0), at(0, 200))).toBe('top');
  });

  it('saindo por baixo, pra um bloco mais à direita: entra pela esquerda', () => {
    expect(targetSide('bottom', at(0, 0), at(NODE_WIDTH * 2, 400))).toBe('left');
  });

  it('saindo pela direita, pro bloco da mesma linha: entra pela esquerda', () => {
    expect(targetSide('right', at(0, 0), at(360, 0))).toBe('left');
  });

  it('saindo pela direita, pra um bloco mais embaixo e mais à direita: entra por cima', () => {
    expect(targetSide('right', at(0, 0), at(960, 1000))).toBe('top');
  });

  it('bloco que fica pra trás: entra pela esquerda', () => {
    expect(targetSide('right', at(640, 0), at(0, 400))).toBe('left');
  });
});
