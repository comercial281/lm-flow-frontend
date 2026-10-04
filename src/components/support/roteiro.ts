import type { SupportKind } from '@/services/support/supportService';

/**
 * Roteiro de dúvidas do chat de suporte — DADO, não componente.
 *
 * Pra editar: mude os textos aqui; o `roteiro.spec.ts` trava o resto (opção
 * apontando pra passo que não existe, passo inalcançável, fim de resposta sem
 * "Isso resolveu?"). O TypeScript também recusa `vai` com id fora de `PassoId`.
 * Texto puro, sem markdown: o balão mostra como está escrito.
 *
 * Os nomes de tela seguem o que aparece NA TELA (frontend/CLAUDE.md, "Nomes").
 */

export type PassoId =
  | 'conectar-whatsapp'
  | 'lead-nao-chegou'
  | 'lead-sem-telefone'
  | 'lead-sem-aviso'
  | 'ia-nao-respondeu'
  | 'cadastrar-imovel'
  | 'dar-acesso-corretor'
  | 'esqueci-senha'
  | 'mover-lead'
  | 'visitas'
  | 'follow-up-nao-saiu'
  | 'editar-site';

export type Acao =
  | { vai: PassoId }
  | { chamado: SupportKind }
  | { guia: string }
  | { whatsapp: true }
  | { inicio: true };

export interface Opcao {
  rotulo: string;
  acao: Acao;
}

export interface Passo {
  /** Balões do "Suporte LM Flow", em ordem. */
  texto: string[];
  opcoes: Opcao[];
  /** Presente nas perguntas da aba Início. */
  pergunta?: string;
  /** Palavras extras que a busca também casa ("qr code" acha o WhatsApp). */
  busca?: string[];
}

export const RESOLVEU: Opcao[] = [
  { rotulo: 'Sim, resolveu', acao: { inicio: true } },
  { rotulo: 'Não, falar com o time', acao: { chamado: 'question' } },
];

const GUIA: Opcao = { rotulo: 'Abrir no Guia do LM Flow', acao: { guia: '/tutorials' } };

/** Fim de resposta: os balões + "Isso resolveu?" + Sim/Não (e extras antes). */
function fim(texto: string[], extras: Opcao[] = []): Pick<Passo, 'texto' | 'opcoes'> {
  return { texto: [...texto, 'Isso resolveu?'], opcoes: [...extras, ...RESOLVEU] };
}

export const ROTEIRO: Record<PassoId, Passo> = {
  'conectar-whatsapp': {
    pergunta: 'Como conecto ou reconecto meu WhatsApp?',
    busca: ['qr code', 'numero', 'desconectou', 'caiu'],
    ...fim(
      [
        'Toque na sua foto, no canto de cima, e escolha Meus números.',
        'Se o número aparece desconectado, toque em Reconectar e leia o QR Code pelo WhatsApp do celular: Dispositivos conectados → Conectar dispositivo.',
        'Não tem número nenhum? Peça ao gestor da sua imobiliária para criar o seu.',
      ],
      [GUIA],
    ),
  },
  'lead-nao-chegou': {
    pergunta: 'O lead não chegou pra mim',
    busca: ['roleta', 'nao recebi', 'aviso'],
    texto: ['Vamos ver. O que aconteceu?'],
    opcoes: [
      { rotulo: 'Recebi o aviso, mas não vejo o telefone', acao: { vai: 'lead-sem-telefone' } },
      { rotulo: 'Não recebi aviso nenhum', acao: { vai: 'lead-sem-aviso' } },
    ],
  },
  'lead-sem-telefone': fim([
    'O telefone do lead só chega depois que você aceita.',
    'Procure o selo Aguardando seu aceite no card do Funil de vendas ou na conversa e toque em Aceitar.',
    'Se o prazo do aceite passou, o lead foi para o próximo corretor da roleta.',
  ]),
  'lead-sem-aviso': fim([
    'Confira com o gestor da sua imobiliária se você está ativo na Roleta de leads.',
    'Para receber o aviso no celular, ligue o Modo Plantão: toque no sininho do Plantão, o que fica ao lado esquerdo do sino de avisos, no topo da tela.',
    'No iPhone, o aviso só funciona com o LM Flow instalado na Tela de Início. Dentro do WhatsApp ou do Instagram não há aviso: abra no Chrome ou no Safari.',
  ]),
  'ia-nao-respondeu': {
    pergunta: 'A IA Vendedora não respondeu o lead',
    busca: ['robo', 'ia', 'agente', 'automatico'],
    ...fim([
      'A IA responde pelo número em que ela está ligada. Confira em Vendas e automação → IA Vendedora se ela está ativa e se o número dela está conectado.',
      'Se a opção Só follow-up estiver marcada, a IA não responde ao vivo: ela só manda o follow-up.',
    ]),
  },
  'cadastrar-imovel': {
    pergunta: 'Como cadastro um imóvel?',
    busca: ['imovel', 'anuncio', 'casa', 'apartamento'],
    ...fim(
      [
        'Vá em Imóveis → Meus imóveis e toque em Novo imóvel.',
        'Dá pra preencher na mão ou colar o texto do anúncio em Preencher a partir de um texto e tocar em Preencher.',
      ],
      [GUIA],
    ),
  },
  'dar-acesso-corretor': {
    pergunta: 'Como dou acesso a um corretor?',
    busca: ['convidar', 'equipe', 'login', 'usuario'],
    ...fim([
      'Quem é gestor adiciona o corretor em Minha imobiliária → Equipe.',
      'O LM Flow manda um link de acesso no WhatsApp dele. Ao abrir, ele cria a própria senha e já entra.',
      'Se precisar, use Copiar link de acesso na Equipe e mande você mesmo.',
    ]),
  },
  'esqueci-senha': {
    pergunta: 'Esqueci minha senha',
    busca: ['senha', 'entrar', 'login', 'acesso'],
    ...fim([
      'Na tela de entrar, toque em Esqueci minha senha e digite seu e-mail.',
      'O link para criar uma senha nova chega no WhatsApp do seu cadastro.',
    ]),
  },
  'mover-lead': {
    pergunta: 'Como mudo o lead de etapa no funil?',
    busca: ['funil', 'etapa', 'card', 'kanban'],
    ...fim(['Em Funil de vendas, arraste o card até a etapa nova.', 'Também dá pra abrir o card e trocar a etapa por lá.']),
  },
  visitas: {
    pergunta: 'Como agendo uma visita e dou retorno?',
    busca: ['visita', 'agenda', 'agendar', 'retorno'],
    ...fim([
      'Em Visitas, toque em Agendar visita e escolha o lead, o imóvel e o horário.',
      'Depois da visita, marque como Realizada e use Dar retorno para registrar a nota e o comentário.',
    ]),
  },
  'follow-up-nao-saiu': {
    pergunta: 'O follow-up não saiu',
    busca: ['follow', 'mensagem automatica', 'sequencia'],
    ...fim([
      'O follow-up só sai no horário configurado em Quando o follow-up pode sair, e para quando o lead responde.',
      'Confira em Vendas e automação → Follow-up se a sequência está ligada.',
    ]),
  },
  'editar-site': {
    pergunta: 'Como edito o site da imobiliária?',
    busca: ['site', 'pagina', 'portal'],
    ...fim(['Quem é gestor edita em Imóveis → Meu site.']),
  },
};

/** Ordem em que as perguntas aparecem na aba Início. */
export const PERGUNTAS: PassoId[] = [
  'conectar-whatsapp',
  'lead-nao-chegou',
  'ia-nao-respondeu',
  'cadastrar-imovel',
  'dar-acesso-corretor',
  'esqueci-senha',
  'mover-lead',
  'visitas',
  'follow-up-nao-saiu',
  'editar-site',
];
