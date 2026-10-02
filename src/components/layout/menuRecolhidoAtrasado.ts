import { useEffect, useState } from 'react';

// Duração do movimento do menu (Tailwind duration-200). Mesma do Sidebar e do Header.
export const DURACAO_MENU_MS = 200;

const semMovimento = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * O que o menu DESENHA, que atrasa só ao recolher: ao recolher, o conteúdo aberto
 * continua na tela até a largura terminar de fechar (cobre/revela); ao abrir, vale
 * na hora. Com "menos movimento", vale na hora nos dois sentidos.
 */
export function useMenuRecolhidoAtrasado(isCollapsed: boolean, ms: number = DURACAO_MENU_MS): boolean {
  const [fechou, setFechou] = useState(isCollapsed);

  useEffect(() => {
    if (!isCollapsed) {
      setFechou(false);
      return;
    }
    const id = setTimeout(() => setFechou(true), ms);
    return () => clearTimeout(id);
  }, [isCollapsed, ms]);

  return isCollapsed && (fechou || semMovimento());
}
