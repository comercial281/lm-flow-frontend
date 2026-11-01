/**
 * "Qual IA atende" na janela e na lista de Campanhas (Tarefa 77, 01/11/2026).
 *
 * ⚠️ Nenhuma regra mora aqui. Quem diz quais IAs podem pegar a campanha, quem sai de onde e o que é
 * proibido é o servidor (`GET /campaigns/agent_options`, `PUT`/`DELETE /campaigns/agent`). Este arquivo só
 * ARRUMA o que o servidor devolveu pra tela: rótulo, o que vem fixo e a frase de "esta campanha sai da IA X".
 */
import type { IaDaCampanha, OpcaoDeIa, QuemSai } from '@/services/campanhas/campanhasService';

export const chaveDaIa = (agente: string, numero: string | null | undefined) => `${agente}|${numero ?? ''}`;

export interface OpcaoNaTela {
  chave: string;
  opcao: OpcaoDeIa;
  rotulo: string;
  /** A IA que atende todo lead do número: aparece, mas não se escolhe. */
  fixa: boolean;
  jaAtende: boolean;
}

export function opcoesDaTela(opcoes: readonly OpcaoDeIa[], donos: readonly IaDaCampanha[]): OpcaoNaTela[] {
  const jaTem = new Set(donos.map((d) => chaveDaIa(d.sales_agent_id, d.sales_agent_number_id)));
  return opcoes.map((opcao) => {
    const chave = chaveDaIa(opcao.sales_agent_id, opcao.number_id);
    let rotulo = opcao.label;
    if (opcao.serves_all) rotulo += ' · atende todo lead do número';
    else if (!opcao.enabled) rotulo += ' (desligada)';
    return { chave, opcao, rotulo, fixa: opcao.serves_all, jaAtende: jaTem.has(chave) };
  });
}

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

/** Quem atende, como a coluna mostra. */
export function donoEmTexto(d: IaDaCampanha): string {
  if (d.whole_number) return `${d.name} · atende todo lead do número`;
  if (d.note) return `${d.name} · ${d.note}`;
  return d.number_label ? `${d.name} · ${d.number_label}` : d.name;
}
