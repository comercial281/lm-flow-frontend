import { useEffect, useMemo, useState } from 'react';
import type { BolsaoQuota } from '@/services/bolsao/bolsaoService';

/**
 * O contador "pode pegar mais N, libera em MM:SS".
 *
 * A cota em si vem SEMPRE do servidor — é a mesma conta que barra a retirada, e
 * calcular aqui faria a tela mentir no primeiro ajuste de regra. O que este hook
 * faz é só o relógio: faz o segundo andar entre uma resposta e outra, para o
 * corretor não ficar olhando um número congelado sem saber se travou.
 */
export function useBolsaoQuota(quota: BolsaoQuota | null) {
  const [now, setNow] = useState(() => Date.now());

  const releasesAt = useMemo(
    () => (quota?.next_available_at ? new Date(quota.next_available_at).getTime() : 0),
    [quota?.next_available_at],
  );

  const blocked = !!quota && quota.remaining <= 0;

  useEffect(() => {
    // Só corre o relógio quando há o que contar. Timer rodando com a cota
    // cheia é bateria do celular do corretor indo embora à toa.
    if (!blocked) return;

    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [blocked]);

  const secondsLeft = blocked ? Math.max(0, Math.ceil((releasesAt - now) / 1000)) : 0;

  const countdown = useMemo(() => {
    if (!blocked) return null;
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [blocked, secondsLeft]);

  return {
    blocked,
    countdown,
    // Quando o relógio zera, quem manda ainda é o servidor: a tela pede a cota de
    // novo em vez de liberar o botão por conta própria.
    expired: blocked && secondsLeft === 0,
  };
}
