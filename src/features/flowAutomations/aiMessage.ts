// Bloco "Mensagem com IA": a instrução de exemplo que o bloco novo já traz.
// Cada obrigação está explícita (quem fala, o que citar, o tamanho, como terminar).

export const INSTRUCAO_DE_EXEMPLO = [
  'Você é {{corretor}}, do time de vendas. Apresente-se pelo nome.',
  'O lead acabou de preencher nosso formulário sobre [descreva o imóvel ou a oferta].',
  'Varie a abertura. Cite 1 ou 2 respostas do formulário que importam (região, objetivo, renda ou entrada).',
  'No máximo 3 frases.',
  'Termine perguntando se esse é o WhatsApp dele.',
].join('\n');

/** O pedaço do gatilho que importa aqui: as condições do principal e dos "Ou quando". */
interface GatilhoComCondicoes {
  conditions: Array<{ field: string; value: unknown }>;
  alternatives?: Array<{ conditions: Array<{ field: string; value: unknown }> }>;
}

/**
 * O formulário do gatilho pra filtrar os leads do Testar: só quando o gatilho
 * aponta pra UM formulário (o `form_id` do Meta). Nenhum ou vários = sem filtro.
 */
export function formularioDoGatilho(gatilho: GatilhoComCondicoes): string | null {
  const partes = [gatilho.conditions, ...(gatilho.alternatives ?? []).map(a => a.conditions)];
  const ids = new Set<string>();
  for (const condicoes of partes) {
    for (const c of condicoes) {
      if (c.field !== 'form_id') continue;
      const valores = Array.isArray(c.value) ? c.value : [c.value];
      valores.forEach(v => { if (typeof v === 'string' && v) ids.add(v); });
    }
  }
  return ids.size === 1 ? [...ids][0] : null;
}
