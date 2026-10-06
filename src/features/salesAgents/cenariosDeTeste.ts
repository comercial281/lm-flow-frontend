import type { TestHistoryItem } from '@/services/salesAgents/salesAgentsService';

/**
 * Um caso pronto pro Testar (e pra comparação de roteiros, no admin). O
 * `subtitulo` aparece embaixo do nome, sem precisar passar o mouse (checklist §6:
 * no celular não existe "passar o mouse").
 */
export interface CenarioDeTeste {
  id: string;
  label: string;
  subtitulo: string;
  contactName: string;
  source: string;
  interest: string;
  formAnswers: Record<string, string>;
  /** Conversa que JÁ aconteceu. Vazio = primeiro contato. */
  history?: TestHistoryItem[];
  /** Há quantas horas foi essa conversa (ex.: 72 = sumiu 3 dias). */
  historyHoursAgo?: number;
  /** Próxima mensagem do lead, já no campo. */
  firstMessage: string;
}

export const CENARIOS_DE_TESTE: CenarioDeTeste[] = [
  {
    id: 'ctwa', label: 'Veio do anúncio',
    subtitulo: 'Abre citando o anúncio e pergunta a intenção, sem despejar preço.',
    contactName: 'Camila', source: 'Anúncio Instagram — clique para WhatsApp', interest: '', formAnswers: {},
    firstMessage: 'oi, vi o anúncio',
  },
  {
    id: 'form', label: 'Formulário do Meta',
    subtitulo: 'Não pode perguntar de novo o que o lead respondeu no formulário.',
    contactName: 'Rodrigo', source: 'Formulário Meta Lead Ads', interest: '',
    formAnswers: { 'Quando pretende comprar?': 'Nos próximos 3 meses', 'Faixa de investimento': 'Até 450 mil', 'É para morar ou investir?': 'Morar' },
    firstMessage: 'oi',
  },
  {
    id: 'visitou-primeiro-contato', label: 'Já visitou',
    subtitulo: 'Visitou o plantão e escreve pela 1ª vez: ela pula a pergunta de intenção.',
    contactName: 'Patrícia', source: 'Anúncio Instagram', interest: 'Já visitou o decorado', formAnswers: {},
    firstMessage: 'eu já visitei semana passada, queria as plantas e o lazer',
  },
  {
    id: 'conversa-andando', label: 'Conversa em andamento',
    subtitulo: 'Continua de onde parou, sem se reapresentar.',
    contactName: 'Marcos', source: 'Anúncio Instagram', interest: '', formAnswers: {},
    history: [
      { role: 'user', content: 'oi, vi o anúncio do residencial' },
      { role: 'assistant', content: 'Oi Marcos! É pra morar ou pra investir?' },
    ],
    firstMessage: 'to só dando uma olhada por enquanto',
  },
  {
    id: 'sumiu-voltou', label: 'Sumiu e voltou',
    subtitulo: 'Parou de responder 3 dias atrás e voltou: retoma sem recomeçar.',
    contactName: 'Juliana', source: 'Anúncio Instagram', interest: '', formAnswers: {},
    history: [
      { role: 'user', content: 'quero saber do apartamento de 2 quartos' },
      { role: 'assistant', content: 'Boa! É pra morar ou investir?' },
    ],
    historyHoursAgo: 72,
    firstMessage: 'oi, desculpa a demora, é pra morar',
  },
  {
    id: 'pede-pessoa', label: 'Pede uma pessoa',
    subtitulo: 'Pede pra falar com alguém: tem que passar na hora, pro destino certo.',
    contactName: 'Renata', source: 'Anúncio Instagram', interest: '', formAnswers: {},
    history: [
      { role: 'user', content: 'oi, vi o anúncio' },
      { role: 'assistant', content: 'Oi Renata! É pra morar ou investir?' },
    ],
    firstMessage: 'prefiro falar com um corretor, pode ser?',
  },
];
