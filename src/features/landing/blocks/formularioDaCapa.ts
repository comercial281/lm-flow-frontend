import type { BlockInstance } from './contract';

/**
 * A capa que leva o formulário dentro dela. Devolve o par só quando o PRIMEIRO
 * bloco visível é uma capa com `formInHero` ligado E existe um formulário
 * visível; o formulário é o primeiro visível (um formulário por página: o
 * segundo, se houver, fica onde está).
 *
 * Qualquer outro caso devolve `null` e a página sai exatamente como antes —
 * coluna estreita, ordem das seções intacta. É o que segura o cliente que
 * ligou a opção e depois apagou ou escondeu o formulário: a capa não fica com
 * um buraco.
 *
 * Pura, sem React: o render, a página pública e o editor perguntam a mesma
 * coisa e precisam da mesma resposta.
 */
export function formularioDaCapa(blocks: BlockInstance[]): { heroId: string; formId: string } | null {
  const primeiro = blocks.find((b) => b.visible);
  if (!primeiro || primeiro.type !== 'hero') return null;
  if ((primeiro.config as { formInHero?: boolean }).formInHero !== true) return null;
  const form = blocks.find((b) => b.type === 'lead_form' && b.visible);
  if (!form) return null;
  return { heroId: primeiro.id, formId: form.id };
}
