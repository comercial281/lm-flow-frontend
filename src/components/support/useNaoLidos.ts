import { useCallback, useEffect, useState } from 'react';
import { useSinalSuporte } from './aoVivo';
import { supportService } from '@/services/support/supportService';

const INTERVALO_MS = 2 * 60 * 1000;

/**
 * Quantos chamados têm resposta do time não lida. Busca ao montar, ao voltar
 * pra aba do navegador e a cada 2 min. Falha de rede deixa o número como
 * estava: o contador é aviso, não pode piscar erro na tela inteira.
 */
export function useNaoLidos() {
  const [naoLidos, setNaoLidos] = useState(0);

  const atualizar = useCallback(async () => {
    try {
      setNaoLidos(await supportService.unreadCount());
    } catch {
      /* mantém o último valor */
    }
  }, []);

  useEffect(() => {
    void atualizar();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void atualizar();
    }, INTERVALO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void atualizar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [atualizar]);

  // Resposta nova do time chega pelo sinal ao vivo: recontar na hora.
  useSinalSuporte(() => void atualizar());

  return { naoLidos, atualizar };
}
