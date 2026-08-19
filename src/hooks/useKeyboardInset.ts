import { useEffect, useRef } from 'react';

/**
 * Custom property escrita no <html>. Sempre leia com fallback: var(--keyboard-inset, 0px).
 * Mesma convenção do --header-height (ContactSidebar).
 */
const CSS_VAR = '--keyboard-inset';

/**
 * Abaixo disso não é teclado. É a barra de endereço encolhendo (44–88px no
 * Safari, 56px no Chrome) ou a barra de rolagem horizontal do desktop (~15px).
 * Acima disso não fica nenhum teclado de verdade de fora: o menor é o do
 * iPhone deitado, ~162px.
 */
const MIN_KEYBOARD_PX = 120;

/** Teto de segurança: nem o iPad deitado passa disso. Sem ele, uma leitura
 *  esquisita colapsaria a tela inteira. */
const MAX_KEYBOARD_RATIO = 0.6;

/**
 * Quanto do rodapé da janela está coberto pelo teclado, em px.
 *
 * Lê innerHeight e visualViewport no mesmo instante de propósito: misturar o
 * innerHeight de um evento com o visualViewport.height de outro produz um
 * número que nunca existiu na tela (é o que causa o pulo de um quadro).
 */
export function readKeyboardInset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0; // desktop antigo, jsdom

  // Pinça: o viewport visual encolhe sem teclado nenhum.
  if (Math.abs(vv.scale - 1) > 0.01) return 0;

  // Área escondida = o que sobra da janela abaixo da parte visível.
  // offsetTop entra na conta porque o iOS empurra o viewport visual para baixo
  // do viewport de layout quando o campo focado está no fim da tela. Sem ele a
  // barra flutuaria um dedo acima do teclado e depois daria um pulo.
  const hidden = window.innerHeight - vv.height - vv.offsetTop;
  if (hidden < MIN_KEYBOARD_PX) return 0;

  return Math.min(Math.round(hidden), Math.round(window.innerHeight * MAX_KEYBOARD_RATIO));
}

type Listener = (inset: number) => void;

const listeners = new Set<Listener>();
let current = 0;
let frame = 0;
let attached = false;

function measure() {
  frame = 0;
  const next = readKeyboardInset();
  if (next === current) return; // não escreve no DOM à toa
  current = next;
  listeners.forEach(listener => listener(next));
}

function schedule() {
  // rAF, não debounce: o iOS dispara dezenas de eventos durante a animação do
  // teclado e a barra precisa subir junto, quadro a quadro. Debounce faria a
  // barra chegar atrasada; rAF só junta os eventos do mesmo quadro.
  if (frame) return;
  frame = window.requestAnimationFrame(measure);
}

function attach() {
  if (attached) return;
  attached = true;
  // resize: a altura muda (teclado abre/fecha, rotação).
  // scroll: no iOS o offsetTop muda sem nenhum resize — é a causa mais comum
  // de "a barra fica 60px fora do lugar no iPhone".
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  // Caminho Android com interactive-widget=resizes-content: quem muda é a janela.
  window.addEventListener('resize', schedule);
  // Sem orientationchange de propósito: ele dispara ANTES das medidas
  // assentarem, então leria valor velho — e a rotação já dispara os resize.
}

function detach() {
  attached = false;
  window.visualViewport?.removeEventListener('resize', schedule);
  window.visualViewport?.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
  current = 0;
}

/** Inscreve um callback nas mudanças do teclado. Devolve a função de cancelar. */
export function subscribeKeyboardInset(listener: Listener): () => void {
  listeners.add(listener);
  attach();
  // Mede AGORA em vez de servir o valor em cache: na primeira inscrição o cache
  // é 0, e remontar a tela com o teclado já aberto (trocar de conversa enquanto
  // digita) entregaria 0 e a barra ficaria atrás do teclado até o próximo evento.
  const next = readKeyboardInset();
  if (next !== current) {
    current = next;
    listeners.forEach(l => l(next)); // mudou de verdade: todo mundo precisa saber
  } else {
    listener(next); // igual ao cache: só o recém-chegado precisa do valor inicial
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
}

/**
 * Mantém --keyboard-inset atualizada no <html> enquanto montado.
 * Deve ser usada no componente raiz da aplicação (MainLayout).
 *
 * Não devolve número de propósito: se devolvesse, cada quadro da animação do
 * teclado re-renderizaria a árvore inteira do CRM. Escrevendo direto no CSS, a
 * barra sobe com zero re-renderização.
 */
export function useKeyboardInsetVar(): void {
  useEffect(() => {
    const root = document.documentElement;
    const unsubscribe = subscribeKeyboardInset(inset => {
      root.style.setProperty(CSS_VAR, `${inset}px`);
      // O iOS às vezes rola o documento para revelar o campo focado e não
      // desfaz sozinho. Na casca do CRM o documento nunca rola (tudo é 100dvh
      // com rolagem interna), então isso só conserta o defeito do iOS — não há
      // rolagem de usuário para atrapalhar.
      if (inset > 0 && window.scrollY !== 0) window.scrollTo(0, 0);
    });
    return () => {
      unsubscribe();
      // Diferente do --header-height (geometria estável, que pode ficar), este
      // valor é passageiro: se a casca desmontar com o teclado aberto, o resto
      // encolheria a próxima tela sem motivo.
      root.style.removeProperty(CSS_VAR);
    };
  }, []);
}

/**
 * Chama `onChange` a cada mudança do teclado SEM re-renderizar o componente.
 * A lista de mensagens usa isso para ficar colada no fim durante a animação.
 */
export function useKeyboardInsetEffect(onChange: Listener): void {
  const ref = useRef(onChange);
  useEffect(() => {
    ref.current = onChange;
  });
  useEffect(() => subscribeKeyboardInset(inset => ref.current(inset)), []);
}
