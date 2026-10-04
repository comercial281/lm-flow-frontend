import { useCallback, useEffect, useRef, useState } from 'react';
import { erroDaApi } from '@/services/support/supportService';

/**
 * Carrega um chamado e busca de novo a cada `intervaloMs` (10 s) enquanto a
 * tela está montada e a aba do navegador visível. Sem tempo real nesta versão.
 *
 * ⚠️ `carregar` precisa ser memoizada (useCallback) POR CHAMADO: quando a
 * identidade muda (outro id), o hook zera `dado`/`erro` e carrega na hora,
 * reiniciando o intervalo. Função nova a cada render = recarga a cada render.
 *
 * `intervaloMs <= 0` = sem intervalo (card fechado: não gasta rede). O intervalo
 * mora num efeito próprio de propósito: pausar/retomar NÃO zera `dado` — zerar
 * desmontaria a caixa de texto e perderia o rascunho de quem fechou o card.
 *
 * Só a requisição mais recente grava estado (uma resposta lenta de antes não
 * sobrescreve a de depois do envio) e o ciclo não empilha: com requisição
 * pendente, o tick é pulado.
 */
export function useChamado<T>(carregar: () => Promise<T>, intervaloMs = 10000) {
  const [dado, setDado] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef(carregar);
  ref.current = carregar;
  const seq = useRef(0);
  const pendente = useRef(false);

  const recarregar = useCallback(async () => {
    const id = ++seq.current;
    pendente.current = true;
    try {
      const novo = await ref.current();
      if (id !== seq.current) return;
      setDado(novo);
      setErro(null);
    } catch (e) {
      if (id !== seq.current) return;
      setErro(erroDaApi(e, 'Não consegui carregar o chamado.'));
    } finally {
      if (id === seq.current) pendente.current = false;
    }
  }, []);

  useEffect(() => {
    setDado(null);
    setErro(null);
    void recarregar();
    return () => {
      seq.current++; // resposta em voo de antes não grava depois
      pendente.current = false;
    };
  }, [carregar, recarregar]);

  useEffect(() => {
    if (intervaloMs <= 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !pendente.current) void recarregar();
    }, intervaloMs);
    return () => window.clearInterval(id);
  }, [recarregar, intervaloMs]);

  return { dado, erro, recarregar };
}
