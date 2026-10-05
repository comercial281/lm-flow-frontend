// Mapa das telas da IA Vendedora (barra de topo própria, modelo do Meu site).
// Fonte única: rótulo do menu, dica, título e frase de cada tela, e a leitura do
// endereço (`?ia=<id>&tela=<id>`).
// Spec: LM FLOW/specs/2026-10-05-ia-vendedora-refatoracao-design.md (entrega 1).

export type GrupoId = 'painel' | 'configurar' | 'ensinar' | 'testar' | 'diagnostico';
export type TelaId = 'visao-geral' | 'sugestoes' | 'relatorio-semanal' | 'configurar' | 'ensinar' | 'testar' | 'diagnostico';

export interface TelaInfo {
  id: TelaId;
  grupo: GrupoId;
  rotulo: string;
  dica: string;
  titulo: string;
  frase: string;
  /** Liberada imobiliária por imobiliária (`ia_insights`); a Leal Mídia sempre vê. */
  soComInsights: boolean;
}

export const GRUPOS: { id: GrupoId; rotulo: string }[] = [
  { id: 'painel', rotulo: 'Painel' },
  { id: 'configurar', rotulo: 'Configurar' },
  { id: 'ensinar', rotulo: 'Ensinar' },
  { id: 'testar', rotulo: 'Testar' },
  { id: 'diagnostico', rotulo: 'Diagnóstico' },
];

export const TELAS: TelaInfo[] = [
  { id: 'visao-geral', grupo: 'painel', rotulo: 'Visão geral', dica: 'Números, pendências e sugestões', titulo: 'Visão geral', frase: 'O que a IA entregou no período e o que falta para ela atender bem.', soComInsights: false },
  { id: 'sugestoes', grupo: 'painel', rotulo: 'Sugestões', dica: 'O que mudar no jeito de ela falar', titulo: 'Sugestões', frase: 'A IA relê as conversas e aponta o que se repete. O que você aplica vira lição em Ensinar.', soComInsights: true },
  { id: 'relatorio-semanal', grupo: 'painel', rotulo: 'Relatório semanal', dica: 'O resumo da semana no WhatsApp', titulo: 'Relatório semanal', frase: 'O resumo da semana dos atendimentos, enviado no WhatsApp para os gestores e grupos.', soComInsights: true },
  { id: 'configurar', grupo: 'configurar', rotulo: 'Configurar', dica: '', titulo: 'Configurar', frase: 'Número, jeito de falar, roteiro, visita, repasse, horários e limites desta IA.', soComInsights: false },
  { id: 'ensinar', grupo: 'ensinar', rotulo: 'Ensinar', dica: '', titulo: 'Ensinar', frase: 'O que ela sabe (arquivos e textos) e as regras e exemplos que você ensinou.', soComInsights: false },
  { id: 'testar', grupo: 'testar', rotulo: 'Testar', dica: '', titulo: 'Testar', frase: 'Converse com a IA fingindo ser um lead. Nada sai no WhatsApp.', soComInsights: false },
  { id: 'diagnostico', grupo: 'diagnostico', rotulo: 'Diagnóstico', dica: '', titulo: 'Diagnóstico', frase: 'Os passos para ela atender, verificados agora, e os últimos atendimentos.', soComInsights: false },
];

const POR_ID = new Map(TELAS.map((t) => [t.id, t]));
const PRIMEIRA: TelaId = 'visao-geral';

export function telaInfo(id: TelaId): TelaInfo {
  return POR_ID.get(id) ?? POR_ID.get(PRIMEIRA)!;
}

/**
 * A tela pedida no endereço. Sem `?tela=`, abre a Visão geral. Tela liberada por
 * chave sem a chave cai na Visão geral: o título de uma coisa que o cliente não
 * comprou nunca aparece (mesma regra das Páginas de anúncio no Meu site).
 *
 * ⚠️ `?agent=<id>` sem `?tela=` é o retorno do assistente (`/ia-vendedora/:id/assistente`):
 * quem volta de lá estava configurando, então cai em Configurar.
 */
export function telaDaUrl(params: URLSearchParams, opts: { insights: boolean }): TelaId {
  const pedida = params.get('tela');
  const info = pedida ? POR_ID.get(pedida as TelaId) : undefined;
  if (info) return info.soComInsights && !opts.insights ? PRIMEIRA : info.id;
  if (!pedida && params.get('agent')) return 'configurar';
  return PRIMEIRA;
}

/** A IA pedida no endereço: `?ia=`, ou o `?agent=` antigo que o assistente ainda usa pra devolver. */
export function iaDaUrl(params: URLSearchParams): string | null {
  return params.get('ia') || params.get('agent') || null;
}

/** O endereço certo pra IA e a tela. A Visão geral é o padrão e não aparece no endereço. */
export function paramsDaIa(ia: string | null, tela: TelaId): Record<string, string> {
  const params: Record<string, string> = {};
  if (ia) params.ia = ia;
  if (tela !== PRIMEIRA) params.tela = tela;
  return params;
}

/**
 * Qual IA abrir: a do endereço, senão a última usada neste navegador, senão a
 * primeira da lista. Id que não está na lista (excluída, de outra conta) é
 * ignorado.
 */
export function iaInicial(ids: string[], doEndereco: string | null, ultima: string | null): string | null {
  if (doEndereco && ids.includes(doEndereco)) return doEndereco;
  if (ultima && ids.includes(ultima)) return ultima;
  return ids[0] ?? null;
}

export function itensDoGrupo(grupo: GrupoId, opts: { insights: boolean }): TelaInfo[] {
  return TELAS.filter((t) => t.grupo === grupo && (!t.soComInsights || opts.insights));
}

/** "Painel" em cima do título das telas de dentro do Painel; vazio nas outras. */
export function trilhaDe(id: TelaId): string {
  const t = telaInfo(id);
  return t.grupo === 'painel' ? 'Painel' : '';
}
