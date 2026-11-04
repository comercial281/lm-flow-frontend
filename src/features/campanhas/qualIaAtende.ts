/**
 * "Qual IA atende" na janela e na lista de Campanhas (Tarefa 77, 01/11/2026).
 *
 * ⚠️ Nenhuma regra mora aqui. Quem diz quais IAs podem pegar a campanha, quem sai de onde e o que é
 * proibido é o servidor (`GET /campaigns/agent_options`, `PUT /campaigns/agent`). Este arquivo só
 * ARRUMA o que o servidor devolveu pra tela: o texto de quem atende e a frase de "esta campanha sai da IA X".
 */
import type { IaDaCampanha, OpcaoDeIa, QuemSai } from '@/services/campanhas/campanhasService';

export const chaveDaIa = (agente: string, numero: string | null | undefined) => `${agente}|${numero ?? ''}`;

/** O nome da IA sem o número que o servidor cola no rótulo ("Agente A · Ana" -> "Agente A"). */
function nomeDaIa(opcoes: readonly OpcaoDeIa[], id: string): string | null {
  const o = opcoes.find((x) => x.sales_agent_id === id);
  return o ? o.label.split(' · ')[0] : null;
}

/** A pergunta antes de mover: o servidor responde 409 com quem perde a campanha. */
export function fraseDeMover(conflitos: readonly QuemSai[], opcoes: readonly OpcaoDeIa[]): string {
  const nomes = [...new Set(conflitos.map((c) => nomeDaIa(opcoes, c.sales_agent_id)))];
  const conhecidos = nomes.filter((n): n is string => !!n);
  if (conhecidos.length === 0) return 'Esta campanha sai de outra IA.';
  return `Esta campanha sai ${conhecidos.map((n) => `da IA ${n}`).join(' e ')}.`;
}

export const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Quem atende, como a coluna mostra. */
export function donoEmTexto(d: IaDaCampanha): string {
  if (d.reason) return `${d.name} · ${maiuscula(d.reason)}`;
  if (d.whole_number) return `${d.name} · atende todo lead do número`;
  if (d.note) return `${d.name} · ${d.note}`;
  return d.number_label ? `${d.name} · ${d.number_label}` : d.name;
}
