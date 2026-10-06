// Mapa das telas da IA Vendedora (barra de topo própria, modelo do Meu site).
// Fonte única: rótulo do menu, dica, título e frase de cada tela, e a leitura do
// endereço (`?ia=<id>&tela=<id>&pagina=<id>`).
//
// Onda 3 (06/10/2026): o menu tem 3 itens (Painel ▾ · Configurar · Ensinar).
// Testar virou botão da barra (janela por cima da página); Diagnóstico e Motor
// moram no "⋯", só equipe (o Motor também pra quem tem `ia_playbook`). As duas
// continuam no mapa, FORA do menu, e o endereço delas sem permissão cai na
// Visão geral. `?tela=testar` antigo abre a Visão geral com a janela por cima.
import { paginaDaUrl, type PaginaId } from '@/pages/Customer/Automations/SalesAgents/configurar/paginas';

export type GrupoId = 'painel' | 'configurar' | 'ensinar';
export type TelaId = 'visao-geral' | 'sugestoes' | 'relatorio-semanal' | 'configurar' | 'ensinar' | 'diagnostico' | 'motor';

export interface TelaInfo {
  id: TelaId;
  /** Null = fora do menu (Diagnóstico, Motor). */
  grupo: GrupoId | null;
  rotulo: string;
  dica: string;
  titulo: string;
  frase: string;
  soComInsights: boolean;
}

export interface Permissoes {
  insights: boolean;
  /** Equipe da Leal Mídia (`useIsSuperAdmin`). */
  equipe: boolean;
  /** Vê o Motor: equipe, ou cliente com `ia_playbook`. */
  motor: boolean;
}

export const GRUPOS: { id: GrupoId; rotulo: string }[] = [
  { id: 'painel', rotulo: 'Painel' },
  { id: 'configurar', rotulo: 'Configurar' },
  { id: 'ensinar', rotulo: 'Ensinar' },
];

export const TELAS: TelaInfo[] = [
  { id: 'visao-geral', grupo: 'painel', rotulo: 'Visão geral', dica: 'Números, pendências e últimos atendimentos', titulo: 'Visão geral', frase: 'O que a IA entregou no período e o que falta para ela atender bem.', soComInsights: false },
  { id: 'sugestoes', grupo: 'painel', rotulo: 'Sugestões', dica: 'O que mudar no jeito de ela falar', titulo: 'Sugestões', frase: 'A IA relê as conversas e aponta o que se repete. O que você aplica vira lição em Ensinar.', soComInsights: true },
  { id: 'relatorio-semanal', grupo: 'painel', rotulo: 'Relatório semanal', dica: 'O resumo da semana no WhatsApp', titulo: 'Relatório semanal', frase: 'O resumo da semana dos atendimentos, enviado no WhatsApp para os gestores e grupos.', soComInsights: true },
  { id: 'configurar', grupo: 'configurar', rotulo: 'Configurar', dica: '', titulo: 'Configurar', frase: '', soComInsights: false },
  { id: 'ensinar', grupo: 'ensinar', rotulo: 'Ensinar', dica: '', titulo: 'Ensinar', frase: 'O que ela sabe (arquivos e textos) e as regras e exemplos que você ensinou.', soComInsights: false },
  { id: 'diagnostico', grupo: null, rotulo: 'Diagnóstico', dica: '', titulo: 'Diagnóstico', frase: 'Os passos para ela atender, verificados agora, e os últimos atendimentos.', soComInsights: false },
  { id: 'motor', grupo: null, rotulo: 'Motor', dica: '', titulo: 'Motor', frase: 'Modelo, ritmo, limites por dia e o texto que a IA recebe.', soComInsights: false },
];

const POR_ID = new Map(TELAS.map((t) => [t.id, t]));
const PRIMEIRA: TelaId = 'visao-geral';

export function telaInfo(id: TelaId): TelaInfo {
  return POR_ID.get(id) ?? POR_ID.get(PRIMEIRA)!;
}

function permitida(id: TelaId, p: Permissoes): boolean {
  const info = POR_ID.get(id)!;
  if (info.soComInsights && !p.insights) return false;
  if (id === 'diagnostico') return p.equipe;
  if (id === 'motor') return p.motor;
  return true;
}

/**
 * A tela pedida no endereço. Sem `?tela=`, a Visão geral. Sem permissão, a Visão
 * geral (o título de algo que a pessoa não pode ver nunca aparece).
 *
 * ⚠️ `?agent=<id>` sem `?tela=` é o retorno do assistente antigo: cai em Configurar.
 * ⚠️ `?tela=configurar&passo=avancado` (entrega 2) é o Motor de hoje.
 */
export function telaDaUrl(params: URLSearchParams, p: Permissoes): TelaId {
  const pedida = params.get('tela');
  if (pedida === 'configurar' && params.get('passo') === 'avancado') return p.motor ? 'motor' : 'configurar';
  const info = pedida ? POR_ID.get(pedida as TelaId) : undefined;
  if (info) return permitida(info.id, p) ? info.id : PRIMEIRA;
  if (!pedida && params.get('agent')) return 'configurar';
  return PRIMEIRA;
}

/** `?tela=testar` (entrega 1–2): a casca abre a janela do Testar por cima da Visão geral. */
export function pediuTestar(params: URLSearchParams): boolean {
  return params.get('tela') === 'testar';
}

export function iaDaUrl(params: URLSearchParams): string | null {
  return params.get('ia') || params.get('agent') || null;
}

/** A página pedida (ou o `?passo=` antigo traduzido). */
export function paginaPedida(params: URLSearchParams): PaginaId | null {
  return paginaDaUrl(params);
}

/**
 * O endereço certo pra IA e a tela. A Visão geral não aparece no endereço.
 * `pagina` só existe em Configurar: sem ela, a casca reescreveria o endereço e o
 * Configurar voltaria sempre pra página inicial.
 */
export function paramsDaIa(ia: string | null, tela: TelaId, pagina?: PaginaId | null): Record<string, string> {
  const params: Record<string, string> = {};
  if (ia) params.ia = ia;
  if (tela !== PRIMEIRA) params.tela = tela;
  if (tela === 'configurar' && pagina) params.pagina = pagina;
  return params;
}

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
  return telaInfo(id).grupo === 'painel' ? 'Painel' : '';
}
