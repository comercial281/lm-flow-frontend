import { useCallback, useEffect, useRef, useState } from 'react';
import { erroDaApi } from '@/services/support/supportService';

/**
 * Carrega um chamado e busca de novo a cada `intervaloMs` (10 s) enquanto a
 * tela está montada e a aba do navegador visível. Sem tempo real nesta versão.
 */
export function useChamado<T>(carregar: () => Promise<T>, intervaloMs = 10000) {
  const [dado, setDado] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef(carregar);
  ref.current = carregar;

  const recarregar = useCallback(async () => {
    try {
      setDado(await ref.current());
      setErro(null);
    } catch (e) {
      setErro(erroDaApi(e, 'Não consegui carregar o chamado.'));
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void recarregar();
    }, intervaloMs);
    return () => window.clearInterval(id);
  }, [recarregar, intervaloMs]);

  return { dado, erro, recarregar };
}
