// Quando a prévia do lead abre e fecha (spec da Agenda, "Como funciona pra quem
// usa"). Mesma família do mini card do Funil (`quadro/useMiniCard.ts`):
// - só o mouse arma (dedo e caneta não têm hover; lá vale o toque, que abre a janela);
// - abre depois do mouse parado `atrasoMs` em cima; enquanto espera, `armando`
//   pinta a barrinha da peça;
// - fecha ao sair, com `folgaMs` pra levar o mouse até o cartão, ao rolar
//   (qualquer rolagem, por isso a captura), ao redimensionar e no Esc;
// - apertou a peça (clique abre a janela): fecha e não reabre até sair e voltar;
// - pelo teclado, o foco arma com a mesma espera. O foco que vem do clique do
//   mouse não arma (`:focus-visible`), senão a prévia pularia ao fechar a janela.
import { useCallback, useEffect, useRef, useState, type FocusEvent, type MutableRefObject, type PointerEvent } from 'react';

export interface OpcoesDaPrevia {
  atrasoMs?: number;
  folgaMs?: number;
}

export interface PropsDoAlvo {
  onPointerEnter: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: PointerEvent<HTMLElement>) => void;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  onBlur: (e: FocusEvent<HTMLElement>) => void;
}

function parar(relogio: MutableRefObject<number | null>) {
  if (relogio.current != null) window.clearTimeout(relogio.current);
  relogio.current = null;
}

function focoDeTeclado(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true; // navegador sem :focus-visible: melhor abrir do que nunca abrir
  }
}

export function usePreviaComAtraso({ atrasoMs = 450, folgaMs = 140 }: OpcoesDaPrevia = {}) {
  const [aberta, setAberta] = useState(false);
  const [armando, setArmando] = useState(false);
  const [ancora, setAncora] = useState<HTMLElement | null>(null);

  const abertaRef = useRef(false);
  abertaRef.current = aberta;
  const ancoraRef = useRef<HTMLElement | null>(null);
  ancoraRef.current = ancora;
  const abrirT = useRef<number | null>(null);
  const fecharT = useRef<number | null>(null);
  const apertado = useRef(false);

  const fechar = useCallback(() => {
    parar(abrirT);
    parar(fecharT);
    setArmando(false);
    setAberta(false);
  }, []);

  const fecharComFolga = useCallback(() => {
    parar(fecharT);
    fecharT.current = window.setTimeout(() => {
      fecharT.current = null;
      setAberta(false);
    }, folgaMs);
  }, [folgaMs]);

  const armar = useCallback((el: HTMLElement) => {
    if (apertado.current) return;
    parar(fecharT);
    if (abertaRef.current && ancoraRef.current === el) return;
    if (abertaRef.current) setAberta(false);
    parar(abrirT);
    setArmando(true);
    abrirT.current = window.setTimeout(() => {
      abrirT.current = null;
      setArmando(false);
      if (!el.isConnected) return;
      setAncora(el);
      setAberta(true);
    }, atrasoMs);
  }, [atrasoMs]);

  const desarmar = useCallback(() => {
    parar(abrirT);
    setArmando(false);
    if (abertaRef.current) fecharComFolga();
  }, [fecharComFolga]);

  const alvoProps: PropsDoAlvo = {
    onPointerEnter: (e) => { if (e.pointerType === 'mouse') armar(e.currentTarget); },
    onPointerLeave: (e) => {
      if (e.pointerType !== 'mouse') return;
      apertado.current = false;
      desarmar();
    },
    onPointerDown: () => {
      apertado.current = true;
      fechar();
    },
    onFocus: (e) => { if (!apertado.current && focoDeTeclado(e.currentTarget)) armar(e.currentTarget); },
    onBlur: () => desarmar(),
  };

  const conteudoProps = {
    onPointerEnter: () => parar(fecharT),
    onPointerLeave: () => fecharComFolga(),
  };

  // Aberta ou esperando: Esc, rolar e redimensionar fecham.
  useEffect(() => {
    if (!aberta && !armando) return;
    const aoTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', aoTecla);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      window.removeEventListener('keydown', aoTecla);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [aberta, armando, fechar]);

  useEffect(() => () => { parar(abrirT); parar(fecharT); }, []);

  return { aberta, armando, ancora, alvoProps, conteudoProps, fechar };
}
