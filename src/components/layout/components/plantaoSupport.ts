// Por que o Modo Plantão não pode ser ligado NESTE aparelho?
//
// O botão sumia calado quando o navegador não aceita notificação push, e
// "sumiu do celular" parecia defeito. Os três casos reais pedem providências
// diferentes, então a tela diz qual é:
//
// - iPhone/iPad fora do app instalado: a Apple só libera notificação de site
//   para o app adicionado à Tela de Início (Safari solto não tem push).
// - Navegador de dentro de outro app (WhatsApp, Instagram, Facebook): é onde o
//   corretor cai ao tocar no link de acesso que chega pelo WhatsApp. Ali não há
//   push em lugar nenhum — precisa abrir no Chrome/Safari.
// - Qualquer outro navegador sem suporte.
//
// Função pura, sem `window`: quem chama passa o ambiente, e o spec testa os
// três casos sem montar navegador.

export type PlantaoUnsupportedReason = 'ios_not_installed' | 'in_app_browser' | 'browser';

export interface PlantaoEnv {
  userAgent: string;
  /** iPadOS se apresenta como Mac; o toque é o que denuncia. */
  maxTouchPoints: number;
  /** Aberto pelo ícone da Tela de Início (app instalado). */
  standalone: boolean;
  supported: boolean;
}

const IN_APP_UA = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|; wv\)/i;

export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  if (/iphone|ipad|ipod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function plantaoUnsupportedReason(env: PlantaoEnv): PlantaoUnsupportedReason | null {
  if (env.supported) return null;
  // O navegador de dentro de outro app vem primeiro: no iPhone ele também é
  // "iOS fora do app instalado", mas instalar dali não funciona — o primeiro
  // passo é sair dele.
  if (IN_APP_UA.test(env.userAgent)) return 'in_app_browser';
  if (isIosDevice(env.userAgent, env.maxTouchPoints) && !env.standalone) return 'ios_not_installed';
  return 'browser';
}

export const PLANTAO_UNSUPPORTED_TEXT: Record<PlantaoUnsupportedReason, { title: string; body: string }> = {
  ios_not_installed: {
    title: 'No iPhone, o plantão só funciona no app instalado',
    body:
      'A Apple só libera notificação para o LM Flow adicionado à Tela de Início. No Safari, toque em ' +
      'Compartilhar → Adicionar à Tela de Início, abra o LM Flow pelo ícone novo e ligue o plantão por lá.',
  },
  in_app_browser: {
    title: 'Este navegador não recebe notificação',
    body:
      'Você abriu o LM Flow por dentro de outro app (WhatsApp, Instagram…). Abra no Chrome ou no Safari ' +
      '— no iPhone, adicione à Tela de Início — e ligue o plantão por lá.',
  },
  browser: {
    title: 'Este navegador não recebe notificação',
    body: 'Abra o LM Flow no Chrome (Android/computador) ou pelo app instalado no iPhone para ligar o plantão.',
  },
};

export function currentPlantaoEnv(supported: boolean): PlantaoEnv {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent || '',
    maxTouchPoints: nav.maxTouchPoints || 0,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true,
    supported,
  };
}
