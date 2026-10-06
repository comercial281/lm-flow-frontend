/**
 * A conversa de exemplo ao lado do passo 1 ("Quem ela é"). Texto FIXO por persona ×
 * tom × emoji, sem chamar a IA: muda na hora em que a pessoa troca a escolha, sem
 * custo e sem esperar.
 *
 * ⚠️ É ilustração do JEITO de falar, não promessa do texto exato. O que muda de
 * persona pra persona é a apresentação e, principalmente, o REPASSE: o corretor
 * diz que ele mesmo vai voltar com as opções (nunca "vou passar pro colega"), o dono
 * passa pro time dele, a consultora fala em nome da imobiliária.
 */
import type { EmojiDaIa, PersonaDaIa, TomDaIa } from '@/services/salesAgents/salesAgentsService';

export interface Mensagem {
  de: 'lead' | 'ia';
  texto: string;
}

export interface DadosDaPrevia {
  persona: PersonaDaIa;
  /** Sem controle na tela na entrega 2 (o v1 não usa emoji e não tem tom): padrão 'close'/'none'. A entrega 4 passa os dois. */
  tom?: TomDaIa;
  emoji?: EmojiDaIa;
  nome: string;
  imobiliaria: string;
}

const NOME_DE_EXEMPLO: Record<PersonaDaIa, string> = { broker: 'Bruno', owner: 'Carlos', assistant: 'Bia' };

export function previaConversa({ persona, tom = 'close', emoji = 'none', nome, imobiliaria }: DadosDaPrevia): Mensagem[] {
  const quem = nome.trim() || NOME_DE_EXEMPLO[persona];
  const onde = imobiliaria.trim() || 'Aurora Imóveis';
  const sorriso = emoji === 'light' ? ' 😊' : '';
  const palmas = emoji === 'light' ? ' 🙌' : '';
  const formal = tom === 'formal';

  const apresentacao = persona === 'owner'
    ? (formal
      ? `Olá! Aqui é ${quem}, dono da ${onde}. Sim, ele ainda está disponível.${sorriso}`
      : `Oi! Aqui é o ${quem}, dono da ${onde}. Tem sim${sorriso}`)
    : persona === 'assistant'
    ? (formal
      ? `Olá! Eu sou ${quem}, consultora da ${onde}. Sim, ele ainda está disponível.${sorriso}`
      : `Oi! Eu sou ${quem}, consultora da ${onde}. Tem sim${sorriso}`)
    : (formal
      ? `Olá! Aqui quem fala é ${quem}, da ${onde}. Sim, ele ainda está disponível.${sorriso}`
      : `Oi! Aqui quem fala é ${quem}, da ${onde}. Tem sim${sorriso}`);

  const repasse: Record<PersonaDaIa, string> = formal
    ? {
      broker: 'Anotado. Vou separar as opções que atendem vocês e já retorno.',
      owner: 'Anotado. Um corretor da minha equipe vai entrar em contato com as opções.',
      assistant: `Anotado. Um corretor da ${onde} vai entrar em contato em seguida.`,
    }
    : {
      broker: 'Anotado! Deixa eu separar as opções que encaixam e já te mando.',
      owner: 'Anotado! Vou pedir pra um corretor do meu time te chamar com as opções.',
      assistant: `Anotado! Um corretor da ${onde} vai te chamar já já.`,
    };

  return [
    { de: 'lead', texto: 'Oi, vi o anúncio do apartamento. Ainda está disponível?' },
    { de: 'ia', texto: apresentacao },
    { de: 'ia', texto: formal ? 'Para eu te ajudar melhor: a compra é para morar ou para investir?' : 'Me conta: é pra você morar ou pra investir?' },
    { de: 'lead', texto: 'Pra morar, eu e minha esposa.' },
    { de: 'ia', texto: formal ? `Perfeito.${palmas} De quantos quartos vocês precisam?` : `Que bom!${palmas} Vocês precisam de quantos quartos?` },
    { de: 'lead', texto: 'Dois quartos, até 400 mil.' },
    { de: 'ia', texto: repasse[persona] },
  ];
}
