import type { LeadFormStep } from '@/features/landing/blocks';

/** Ids escritos à mão e estáveis: o destino por resposta (settings) é indexado
 *  por eles. Nenhuma opção desqualifica; só os pesos separam quente de frio. */
function pergunta(n: number, question: string, opcoes: Array<[string, number]>): LeadFormStep {
  return {
    id: `q${n}`,
    question,
    options: opcoes.map(([text, weight], i) => ({ id: `q${n}o${i + 1}`, text, weight })),
  };
}

export const PERGUNTAS_REVENDA: LeadFormStep[] = [
  pergunta(1, 'Quando você quer visitar?', [
    ['Esta semana', 3],
    ['Nas próximas semanas', 2],
    ['Só estou pesquisando', 0],
  ]),
  pergunta(2, 'Como pretende pagar?', [
    ['À vista', 3],
    ['Financiamento aprovado', 3],
    ['Vou financiar', 2],
    ['Usar FGTS', 2],
    ['Ainda não sei', 0],
  ]),
];

export const PERGUNTAS_ALUGUEL: LeadFormStep[] = [
  pergunta(1, 'Quando você quer se mudar?', [
    ['Ainda este mês', 3],
    ['Em até 3 meses', 2],
    ['Só estou pesquisando', 0],
  ]),
  pergunta(2, 'Qual garantia você prefere?', [
    ['Fiador', 1],
    ['Seguro fiança', 1],
    ['Caução', 1],
    ['Ainda não sei', 0],
  ]),
];
