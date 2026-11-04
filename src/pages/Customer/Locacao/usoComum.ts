import { useCallback, useEffect, useState } from 'react';
import type { Severidade } from '@/features/locacao/tipos';

export const COR_DO_PONTO: Record<Severidade, string> = {
  bad: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-sky-500',
  ok: 'bg-emerald-500',
};

/**
 * Carrega um dado da API. `chave` muda → carrega de novo. O pedido mais novo vale:
 * resposta atrasada de um pedido velho não sobrescreve.
 */
export function useCarga<T>(buscar: () => Promise<T>, chave: string) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [rodada, setRodada] = useState(0);
  useEffect(() => {
    let vivo = true;
    setErro(null);
    buscar().then(d => { if (vivo) setDados(d); }).catch((e: unknown) => { if (vivo) setErro(e); });
    return () => { vivo = false; };
    // `buscar` é recriada a cada render; o que decide recarregar é a `chave` e a `rodada`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, rodada]);
  const recarregar = useCallback(() => setRodada(n => n + 1), []);
  return { dados, erro, recarregar, setDados };
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-11" -> "novembro de 2026". */
export function rotuloDoMes(ref: string): string {
  const mes = MESES[Number(ref.slice(5, 7)) - 1] ?? ref;
  return `${mes} de ${ref.slice(0, 4)}`;
}

/** Soma `n` meses a "AAAA-MM". */
export function mesMais(ref: string, n: number): string {
  const total = Number(ref.slice(0, 4)) * 12 + (Number(ref.slice(5, 7)) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
