/**
 * Duplicar a IA para plugar em outro número (23/09/2026).
 *
 * O servidor faz a cópia; aqui mora só o que a janela mostra — o nome sugerido e
 * a frase de resultado. Fora do JSX porque a tela da IA tem ~5.400 linhas e nada
 * testável cabe dentro dela.
 */
import type { DuplicatedSalesAgent } from '@/services/salesAgents/salesAgentsService';

/** O MESMO nome que o servidor daria se o campo fosse vazio. */
export function defaultCopyName(name: string | null | undefined): string {
  const base = (name ?? '').trim() || 'IA Vendedora';
  return `${base} (cópia)`.slice(0, 200);
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * O que foi copiado, em português. Diz sempre que a cópia está DESLIGADA: é a
 * primeira coisa que quem duplicou precisa saber, senão ele espera a IA nova
 * atendendo e ela não atende.
 */
export function duplicateSummary(agent: Pick<DuplicatedSalesAgent, 'name' | 'duplicated'>): string {
  const d = agent.duplicated;
  const partes = ['a configuração'];
  if (d?.lessons) partes.push(plural(d.lessons, 'lição', 'lições'));
  if (d?.documents) partes.push(plural(d.documents, 'arquivo da base', 'arquivos da base'));
  const levou = partes.length > 1
    ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
    : partes[0];
  return `"${agent.name}" criada com ${levou}. Ela está DESLIGADA — confira e ligue quando quiser.`;
}
