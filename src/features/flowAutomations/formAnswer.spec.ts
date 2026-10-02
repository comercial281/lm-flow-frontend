import { describe, it, expect } from 'vitest';
import {
  emptyFormAnswer,
  formAnswerOf,
  formAnswerProblem,
  formAnswerSentence,
  formsFrom,
  isOptionChecked,
  pickForm,
  pickQuestion,
  questionsFrom,
  setAnswered,
  setContains,
  toggleOption,
  typeQuestion,
  type FormQuestion,
} from './formAnswer';

const form = { source: 'meta' as const, form_id: 'f1', name: 'Lançamento Vila Nova' };
const valor: FormQuestion = {
  key: 'qual_o_valor',
  label: 'Qual o valor do imóvel?',
  type: 'CUSTOM',
  options: [
    { key: 'ate_r$_300_mil', value: 'Até R$ 300 mil' },
    { key: 'de_r$_300_a_500_mil', value: 'De R$ 300 a 500 mil' },
    { key: 'acima', value: 'Acima de R$ 500 mil' },
  ],
};

describe('a escolha em três passos monta a config do contrato', () => {
  it('formulário → pergunta → opções', () => {
    let c = pickForm(emptyFormAnswer(), form);
    c = pickQuestion(c, valor);
    c = toggleOption(c, valor.options, valor.options[0]);
    c = toggleOption(c, valor.options, valor.options[1]);
    expect(c).toMatchObject({
      criterion: 'form_answer',
      form_source: 'meta',
      form_id: 'f1',
      form_name: 'Lançamento Vila Nova',
      question_key: 'qual_o_valor',
      question_label: 'Qual o valor do imóvel?',
      match: 'any_of',
    });
    // chave E texto de cada opção marcada: o Meta devolve um ou outro.
    expect(c.values).toEqual(['ate_r$_300_mil', 'Até R$ 300 mil', 'de_r$_300_a_500_mil', 'De R$ 300 a 500 mil']);
    expect(c.value_labels).toEqual(['Até R$ 300 mil', 'De R$ 300 a 500 mil']);
    expect(isOptionChecked(c, valor.options[0])).toBe(true);
    expect(isOptionChecked(c, valor.options[2])).toBe(false);
  });

  it('desmarcar tira a chave e o texto', () => {
    let c = pickQuestion(pickForm(emptyFormAnswer(), form), valor);
    c = toggleOption(c, valor.options, valor.options[0]);
    c = toggleOption(c, valor.options, valor.options[0]);
    expect(c.values).toEqual([]);
    expect(formAnswerProblem(c)).toBe('Marque pelo menos uma resposta.');
  });

  it('pergunta aberta: contém o texto, ou respondeu qualquer coisa', () => {
    const aberta = { key: 'obs', label: 'Algo mais?', options: [] };
    let c = pickQuestion(pickForm(emptyFormAnswer(), form), aberta);
    expect(c.match).toBe('answered');
    c = setContains(c, 'financiamento');
    expect(c).toMatchObject({ match: 'contains', values: ['financiamento'] });
    c = setAnswered(c);
    expect(c).toMatchObject({ match: 'answered', values: [] });
    expect(formAnswerProblem(c)).toBeNull();
  });

  it('trocar de formulário zera pergunta e resposta', () => {
    let c = pickQuestion(pickForm(emptyFormAnswer(), form), valor);
    c = pickForm(c, { source: 'site', form_id: 's1', name: 'Contato do site' });
    expect(c).toMatchObject({ form_source: 'site', form_id: 's1', question_key: '', values: [] });
  });

  it('pergunta digitada à mão (o Meta não respondeu)', () => {
    const c = typeQuestion(pickForm(emptyFormAnswer(), form), 'Qual o valor?');
    expect(c).toMatchObject({ question_key: 'Qual o valor?', question_label: 'Qual o valor?' });
  });
});

describe('a frase do bloco', () => {
  it('igual ao exemplo da spec', () => {
    let c = pickQuestion(pickForm(emptyFormAnswer(), form), { ...valor, label: 'Qual o valor do imóvel?' });
    c = toggleOption(c, valor.options, valor.options[0]);
    c = toggleOption(c, valor.options, valor.options[1]);
    expect(formAnswerSentence(c)).toBe(
      'Se no formulário "Lançamento Vila Nova" a resposta de "Qual o valor do imóvel?" for "Até R$ 300 mil" ou "De R$ 300 a 500 mil"',
    );
  });

  it('contém e respondeu', () => {
    const c = pickQuestion(pickForm(emptyFormAnswer(), form), { key: 'obs', label: 'Algo mais?', options: [] });
    expect(formAnswerSentence(c)).toBe('Se no formulário "Lançamento Vila Nova" a pergunta "Algo mais?" foi respondida');
    expect(formAnswerSentence(setContains(c, 'casa'))).toBe(
      'Se no formulário "Lançamento Vila Nova" a resposta de "Algo mais?" contiver "casa"',
    );
  });

  it('incompleta diz o que falta', () => {
    expect(formAnswerSentence(emptyFormAnswer())).toContain('escolha o formulário');
    expect(formAnswerProblem(emptyFormAnswer())).toBe('Escolha o formulário.');
  });
});

describe('leitura', () => {
  it('config gravada com lixo vira vazio', () => {
    expect(formAnswerOf({ match: 'xyz', values: 'a', form_source: 'tiktok' })).toMatchObject({ match: 'answered', values: [], form_source: '' });
  });

  it('formulários e perguntas da API', () => {
    expect(formsFrom([{ source: 'site', form_id: 7, name: 'Contato' }, { source: 'meta', form_id: '' }])).toEqual([
      { source: 'site', form_id: '7', name: 'Contato' },
    ]);
    expect(questionsFrom({ questions: [{ key: 'k', label: 'L', type: 'x', options: [{ key: 'a', value: 'A' }] }], error: null }))
      .toEqual({ questions: [{ key: 'k', label: 'L', type: 'x', options: [{ key: 'a', value: 'A' }] }], error: null });
  });

  it('erro do Meta vem como texto e lista vazia', () => {
    expect(questionsFrom({ questions: [], error: 'Não consegui ler as perguntas desse formulário no Meta agora' }))
      .toEqual({ questions: [], error: 'Não consegui ler as perguntas desse formulário no Meta agora' });
  });
});
