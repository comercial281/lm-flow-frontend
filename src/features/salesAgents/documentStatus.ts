// "Lendo o arquivo…" dos Arquivos do Ensinar da IA Vendedora (era "Processando..."
// da Base de Conhecimento até 11/10/2026).
//
// Por que isto existe fora da tela: o texto fixo "Processando..." era idêntico depois
// de dois segundos e depois de dois dias. Quem sobe o material e fica olhando não
// tem como saber se ainda está andando ou se parou — e foi exatamente esse silêncio
// que virou relato ("não acaba o carregamento"). Aqui o texto passa a dizer HÁ
// QUANTO TEMPO, e depois de alguns minutos a tela avisa que já não é normal.
//
// A lógica mora num arquivo próprio, com teste: é a única fonte do texto do cartão
// pendente (o selo do cartão mostra exatamente o que sai daqui).

// A partir daqui a espera deixou de ser normal. Menor que a carência do servidor
// para retomar o arquivo preso (3 minutos), de propósito: o aviso aparece junto com
// a retomada, não depois dela.
export const SLOW_AFTER_MS = 3 * 60 * 1000;

// Depois disto o servidor desiste e marca falha com o motivo. O número está escrito
// no aviso para a espera ter FIM visível — "daqui a pouco" não é resposta para quem
// já está esperando.
export const GIVE_UP_MINUTES = 20;

function minutesSince(createdAt?: string | null, now: Date = new Date()): number | null {
  if (!createdAt) return null;
  const inicio = new Date(createdAt).getTime();
  if (Number.isNaN(inicio)) return null;
  const decorrido = now.getTime() - inicio;
  if (decorrido < 0) return 0;
  return Math.floor(decorrido / 60000);
}

/** O selo do cartão enquanto o arquivo está sendo lido. */
export function processingLabel(createdAt?: string | null, now: Date = new Date()): string {
  const min = minutesSince(createdAt, now);
  if (min === null || min < 1) return 'Lendo o arquivo…';
  return `Lendo há ${min} min`;
}

/**
 * O aviso que aparece quando a leitura passou do tempo normal. `null` enquanto a
 * espera ainda é normal — aviso que aparece sempre vira paisagem e ninguém lê.
 */
export function processingWarning(createdAt?: string | null, now: Date = new Date()): string | null {
  const min = minutesSince(createdAt, now);
  if (min === null || min * 60000 < SLOW_AFTER_MS) return null;
  return `Está demorando mais que o normal. O sistema tenta de novo sozinho; se passar de ${GIVE_UP_MINUTES} minutos, ele marca como falha e diz o motivo. Você também pode tentar de novo pelo menu ⋮ do arquivo.`;
}
