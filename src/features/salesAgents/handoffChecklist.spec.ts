import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { checklistItems, checklistNotices, normalizeQuestion, toggleRequired } from './handoffChecklist';

// O cenário "Só depois de arrancar as informações do lead" (21/09/2026).
//
// O cenário da temperatura é PERMISSÃO, não gatilho, e "morno" é palpite do modelo (uma
// linha de instrução: "interessado sem urgência") — dava para o lead cair na roleta sem
// uma pergunta respondida. Este troca o palpite pelo fato.
//
// A mecânica mora no servidor. Aqui ficam as três cicatrizes desta tela, e todas são
// CALADAS: nenhuma quebra tipo, render ou build.
describe('normalizeQuestion', () => {
  it('ignora acento, caixa e pontuação', () => {
    expect(normalizeQuestion('Faixa de Orçamento!')).toBe(normalizeQuestion('faixa de orcamento'));
  });

  it('colapsa espaço', () => {
    expect(normalizeQuestion('  Região   de  interesse ')).toBe('regiao de interesse');
  });

  // ⚠️ O intervalo de acentos vai escrito em escape no fonte. Caractere combinante
  // literal é apagado por qualquer normalização de editor, e a comparação passa a nunca
  // casar — a pergunta aparece desmarcada e o portão continua cobrando. Mesma cicatriz do
  // conversor de nome em endereço da landing.
  it('escreve o intervalo de acentos em escape, nunca com os caracteres literais', () => {
    const fonte = readFileSync(resolve(__dirname, 'handoffChecklist.ts'), 'utf8');
    expect(fonte).toContain('\\u0300-\\u036f');
  });
});

describe('checklistItems', () => {
  const perguntas = ['Faixa de orçamento', 'Região de interesse', 'Prazo pra mudar'];

  it('marca só as escolhidas', () => {
    const itens = checklistItems(perguntas, ['Faixa de orçamento']);
    expect(itens.filter((i) => i.required).map((i) => i.text)).toEqual(['Faixa de orçamento']);
  });

  it('casa a marca sem exigir acento nem pontuação', () => {
    const itens = checklistItems(perguntas, ['faixa de orcamento!']);
    expect(itens[0].required).toBe(true);
  });

  // ⚠️ Lista vazia significa TODAS no servidor. Desenhar as caixinhas desmarcadas aqui
  // faria a tela mentir sobre o que está valendo.
  it('sem nenhuma marcada, desenha TODAS marcadas', () => {
    const itens = checklistItems(perguntas, []);
    expect(itens.every((i) => i.required)).toBe(true);
  });

  it('trata lista de obrigatórias ausente como todas', () => {
    expect(checklistItems(perguntas).every((i) => i.required)).toBe(true);
  });

  // ⚠️ O servidor MANTÉM obrigatória a pergunta que saiu da lista (afrouxar o portão em
  // silêncio é o pior desfecho). Sumir com ela na tela a tiraria do portão sem ninguém ver.
  it('mostra a obrigatória que já não está na lista, marcada e sinalizada', () => {
    const itens = checklistItems(perguntas, ['Tem imóvel pra dar de entrada?']);
    const orfa = itens[itens.length - 1];
    expect(orfa.text).toBe('Tem imóvel pra dar de entrada?');
    expect(orfa.required).toBe(true);
    expect(orfa.orphan).toBe(true);
  });

  it('descarta pergunta em branco', () => {
    expect(checklistItems(['Orçamento', '  ', ''], ['Orçamento'])).toHaveLength(1);
  });
});

describe('toggleRequired', () => {
  const perguntas = ['Faixa de orçamento', 'Região de interesse', 'Prazo pra mudar'];

  it('marca uma pergunta que não estava marcada', () => {
    expect(toggleRequired(perguntas, ['Faixa de orçamento'], 'Prazo pra mudar'))
      .toEqual(['Faixa de orçamento', 'Prazo pra mudar']);
  });

  it('desmarca uma pergunta marcada', () => {
    expect(toggleRequired(perguntas, ['Faixa de orçamento', 'Prazo pra mudar'], 'Prazo pra mudar'))
      .toEqual(['Faixa de orçamento']);
  });

  // ⚠️ Partindo de "nenhuma marcada" (que vale como TODAS), desmarcar precisa gravar as
  // outras EXPLICITAMENTE. Sem isso a lista continuaria vazia — ou seja, todas
  // obrigatórias — e a caixinha voltaria marcada sozinha no próximo render.
  it('desmarcando a partir de "todas", grava as outras explicitamente', () => {
    expect(toggleRequired(perguntas, [], 'Prazo pra mudar'))
      .toEqual(['Faixa de orçamento', 'Região de interesse']);
  });

  // ⚠️ Lista vazia significa o OPOSTO no servidor, então desmarcar a última não pode
  // gravar `[]`: isso religaria todas.
  it('não deixa desmarcar a última (vazio significaria todas)', () => {
    expect(toggleRequired(perguntas, ['Faixa de orçamento'], 'Faixa de orçamento')).toBeNull();
  });

  it('desmarca a órfã sem mexer nas outras', () => {
    const proximas = toggleRequired(perguntas, ['Faixa de orçamento', 'Pergunta apagada'], 'Pergunta apagada');
    expect(proximas).toEqual(['Faixa de orçamento']);
  });
});

describe('checklistNotices', () => {
  const perguntas = ['Faixa de orçamento', 'Região de interesse'];

  it('avisa que sem marcar nenhuma TODAS valem', () => {
    const avisos = checklistNotices(perguntas, []);
    expect(avisos.some((a) => a.tone === 'amber' && a.text.includes('TODAS'))).toBe(true);
  });

  it('não repete esse aviso quando há marcada', () => {
    const avisos = checklistNotices(perguntas, ['Faixa de orçamento']);
    expect(avisos.some((a) => a.text.includes('TODAS'))).toBe(false);
  });

  it('avisa quando uma obrigatória saiu da lista', () => {
    const avisos = checklistNotices(perguntas, ['Faixa de orçamento', 'Pergunta apagada']);
    expect(avisos.some((a) => a.tone === 'amber' && a.text.includes('não está mais'))).toBe(true);
  });

  // Sem pergunta escrita não há portão possível, e o cenário fica decorativo. Dizer isso
  // é o que separa "configurei e não funciona" de uma escolha consciente.
  it('avisa quando não há pergunta de qualificação nenhuma', () => {
    const avisos = checklistNotices([], []);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].tone).toBe('amber');
    expect(avisos[0].text).toContain('nenhuma pergunta de qualificação');
  });

  it('sempre explica a saída de emergência', () => {
    const avisos = checklistNotices(perguntas, ['Faixa de orçamento']);
    expect(avisos.some((a) => a.text.includes('pede a visita'))).toBe(true);
  });
});

// A tela monta o PATCH campo a campo e descarta em silêncio o que não estiver na lista do
// `saveAgent` — a cicatriz dos dois campos do book do imóvel, que a tela mostra e não
// salva. `transfer_config` já está lá, e é por dentro dele que as obrigatórias viajam.
describe('a gravação passa pelo saveAgent', () => {
  const tela = readFileSync(
    resolve(__dirname, '../../pages/Customer/Automations/SalesAgents/SalesAgents.tsx'),
    'utf8',
  );

  it('transfer_config está na lista campo a campo', () => {
    expect(tela).toMatch(/transfer_config:\s*patch\.transfer_config/);
  });

  // As obrigatórias NÃO podem virar um campo solto do agente: fora do transfer_config
  // elas precisariam de uma linha própria no saveAgent e nos dois controllers do servidor.
  it('as obrigatórias viajam dentro do transfer_config, não como campo solto', () => {
    expect(tela).toContain('required_questions: proximas');

    // Toda GRAVAÇÃO das obrigatórias sai por dentro do transfer_config. Como campo solto
    // do agente, elas precisariam de linha própria no saveAgent e nos dois controllers do
    // servidor — e sem isso seriam descartadas em silêncio, com a tela dizendo *Salvo*.
    const gravacoes = tela
      .split('\n')
      .filter((linha) => linha.includes('onSave') && linha.includes('required_questions'));
    expect(gravacoes.length).toBeGreaterThan(0);
    gravacoes.forEach((linha) => expect(linha).toContain('transfer_config'));
  });
});
