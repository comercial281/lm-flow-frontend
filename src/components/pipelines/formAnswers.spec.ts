import { describe, it, expect } from 'vitest';
import { normalizeFormAnswers, landingVerdict } from './formAnswers';

describe('normalizeFormAnswers', () => {
  it('lê os pares soltos do formulário do Meta', () => {
    expect(normalizeFormAnswers({ 'Qual seu orçamento?': 'Acima de 1 milhão' })).toEqual([
      { label: 'Qual seu orçamento?', value: 'Acima de 1 milhão' },
    ]);
  });

  // O formato do lead de landing JÁ capturado: cru, o card imprimia
  // "[object Object]" em cada pergunta.
  it('abre a lista de perguntas da landing em uma linha por pergunta', () => {
    const rows = normalizeFormAnswers({
      answers: [
        { question: 'Qual seu orçamento?', answer: 'Acima de 1 milhão', optionId: 'o-alto' },
        { question: 'Quando pretende comprar?', answer: 'Este mês' },
      ],
    });

    expect(rows).toEqual([
      { label: 'Qual seu orçamento?', value: 'Acima de 1 milhão' },
      { label: 'Quando pretende comprar?', value: 'Este mês' },
    ]);
  });

  it('não mostra o rastreio do anúncio como se fosse resposta', () => {
    const rows = normalizeFormAnswers({
      answers: [{ question: 'Bairro', answer: 'Centro' }],
      event_id: 'lp-123',
      fbp: 'fb.1.2.3',
      fbc: 'fb.1.4.5',
      landing_url: 'https://exemplo.com/lp',
      referrer: 'https://facebook.com',
    });

    expect(rows).toEqual([{ label: 'Bairro', value: 'Centro' }]);
  });

  it('junta a múltipla escolha numa linha só', () => {
    const rows = normalizeFormAnswers({ answers: [{ question: 'O que procura?', answer: ['Apartamento', 'Casa'] }] });
    expect(rows).toEqual([{ label: 'O que procura?', value: 'Apartamento, Casa' }]);
  });

  it('mantém as duas quando a mesma pergunta aparece duas vezes', () => {
    const rows = normalizeFormAnswers({
      answers: [
        { question: 'Bairro', answer: 'Centro' },
        { question: 'Bairro', answer: 'Jardins' },
      ],
    });
    expect(rows).toHaveLength(2);
  });

  it('descarta resposta vazia e pergunta sem texto', () => {
    const rows = normalizeFormAnswers({
      answers: [
        { question: '', answer: 'sem pergunta' },
        { question: 'Sem resposta', answer: '' },
        { question: 'Vale', answer: 'sim' },
      ],
      'Campo vazio': '',
    });
    expect(rows).toEqual([{ label: 'Vale', value: 'sim' }]);
  });

  it('nunca devolve "[object Object]"', () => {
    const rows = normalizeFormAnswers({ estranho: { a: 1 }, answers: [{ question: 'Ok', answer: 'sim' }] });
    expect(rows.every((r) => !r.value.includes('object Object'))).toBe(true);
    expect(rows).toEqual([{ label: 'Ok', value: 'sim' }]);
  });

  it('troca sublinhado por espaço só na chave técnica', () => {
    expect(normalizeFormAnswers({ nome_completo: 'Fulano' })[0].label).toBe('nome completo');
  });

  it('devolve lista vazia sem respostas', () => {
    expect(normalizeFormAnswers(null)).toEqual([]);
    expect(normalizeFormAnswers(undefined)).toEqual([]);
    expect(normalizeFormAnswers('texto')).toEqual([]);
    expect(normalizeFormAnswers({})).toEqual([]);
  });
});

describe('landingVerdict', () => {
  it('lê o resultado da régua gravado no card', () => {
    expect(landingVerdict({ qualification: 'qualified', intent_score: 10 })).toEqual({
      label: 'Qualificado', score: 10, approved: true,
    });
    expect(landingVerdict({ qualification: 'disqualified', intent_score: 0 })).toEqual({
      label: 'Desqualificado', score: 0, approved: false,
    });
  });

  it('aceita a nota como texto e vive sem nota', () => {
    expect(landingVerdict({ qualification: 'qualified', intent_score: '7' })?.score).toBe(7);
    expect(landingVerdict({ qualification: 'qualified' })?.score).toBeNull();
  });

  it('não inventa selo para lead que não passou por régua nenhuma', () => {
    expect(landingVerdict({ lead_source: 'landing' })).toBeNull();
    expect(landingVerdict(null)).toBeNull();
  });
});
