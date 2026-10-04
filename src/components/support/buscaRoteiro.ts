import { PERGUNTAS, ROTEIRO, type PassoId } from './roteiro';

export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Perguntas do Início que contêm TODAS as palavras do termo (pergunta + sinônimos). */
export function buscarPerguntas(termo: string): PassoId[] {
  const palavras = normalizar(termo).split(' ').filter(Boolean);
  if (!palavras.length) return [...PERGUNTAS];
  return PERGUNTAS.filter(id => {
    const passo = ROTEIRO[id];
    const alvo = normalizar([passo.pergunta ?? '', ...(passo.busca ?? [])].join(' '));
    return palavras.every(p => alvo.includes(p));
  });
}
