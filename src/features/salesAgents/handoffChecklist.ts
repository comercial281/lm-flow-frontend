/**
 * O cenário "Só depois de arrancar as informações do lead": quais das *Perguntas de
 * qualificação* seguram a entrega ao corretor.
 *
 * Por que isto existe: o cenário "Só quando o lead estiver quente" é uma PERMISSÃO, não
 * um gatilho — quem decide a hora continua sendo a IA. E "morno" é palpite dela (uma
 * linha de instrução: "interessado sem urgência"), sem exigir nenhuma pergunta
 * respondida. Este cenário troca o palpite pelo FATO: o lead respondeu, ou não.
 *
 * A regra vive aqui, e não no JSX, pelo mesmo motivo do horário do follow-up e do banner
 * da home: a tela da IA tem ~4.800 linhas e nada testável cabe dentro dela. Quem manda
 * de verdade é o servidor; esta é a metade que desenha a escolha.
 */

/**
 * A marca de obrigatória é casada contra o TEXTO da pergunta, que é digitado à mão.
 * Exigir a grafia exata faria um acento a mais desmarcar a pergunta em silêncio.
 *
 * ⚠️ O intervalo de acentos vai escrito em escape (`\u0300-\u036f`), NUNCA com os
 * caracteres combinantes literais: qualquer normalização de editor os apaga calado e a
 * comparação passa a nunca casar. Mesma cicatriz do conversor de nome em endereço da
 * landing e da leitura das respostas do formulário.
 *
 * Tem que bater com a normalização do servidor — enquanto as duas discordarem, existe
 * pergunta que a tela mostra marcada e o portão não cobra.
 */
export function normalizeQuestion(text: string): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface ChecklistItem {
  text: string;
  required: boolean;
  /**
   * Marcada como obrigatória e já FORA da lista de perguntas — o gestor reescreveu ou
   * apagou a pergunta depois de marcá-la. O servidor a MANTÉM obrigatória (afrouxar o
   * portão em silêncio é o pior desfecho possível aqui), então a tela precisa mostrá-la
   * e dizer por que ela está ali. Sumir com ela a tiraria do portão sem ninguém ver.
   */
  orphan: boolean;
}

/**
 * A lista que a tela desenha: as perguntas na ordem da tela, mais as obrigatórias que já
 * não estão nela, no fim.
 *
 * `required` vazio significa TODAS obrigatórias, e isso NÃO é um detalhe de exibição: é
 * o que o servidor faz (portão vazio seria um cenário decorativo). Desenhar as caixinhas
 * desmarcadas nesse caso mentiria sobre o que está valendo.
 */
export function checklistItems(questions: string[], required?: string[]): ChecklistItem[] {
  const perguntas = (questions ?? []).map((q) => (q ?? '').trim()).filter(Boolean);
  const marcadas = (required ?? []).map((q) => (q ?? '').trim()).filter(Boolean);
  const todas = marcadas.length === 0;

  const chavesMarcadas = new Set(marcadas.map(normalizeQuestion));
  const chavesListadas = new Set(perguntas.map(normalizeQuestion));

  const itens: ChecklistItem[] = perguntas.map((text) => ({
    text,
    required: todas || chavesMarcadas.has(normalizeQuestion(text)),
    orphan: false,
  }));

  const orfas = marcadas.filter((t) => !chavesListadas.has(normalizeQuestion(t)));
  orfas.forEach((text) => itens.push({ text, required: true, orphan: true }));

  return itens;
}

/**
 * O clique numa caixinha. Devolve a lista de obrigatórias a gravar.
 *
 * ⚠️ Desmarcar a partir do estado "nenhuma marcada" (que vale como TODAS) precisa gravar
 * as outras EXPLICITAMENTE — senão a lista continuaria vazia, ou seja todas obrigatórias,
 * e a caixinha voltaria marcada sozinha. Era o caminho mais fácil de a tela mentir.
 *
 * E desmarcar a ÚLTIMA não pode gravar lista vazia, porque vazio quer dizer o oposto:
 * nesse caso o resultado é `null`, que a tela trata como "não dá para desmarcar todas" —
 * quem não quer portão nenhum troca de cenário.
 */
export function toggleRequired(
  questions: string[],
  required: string[] | undefined,
  text: string,
): string[] | null {
  const itens = checklistItems(questions, required);
  const chave = normalizeQuestion(text);
  const alvo = itens.find((i) => normalizeQuestion(i.text) === chave);
  if (!alvo) return required ?? [];

  const proximas = itens
    .filter((i) => (normalizeQuestion(i.text) === chave ? !alvo.required : i.required))
    .map((i) => i.text);

  return proximas.length === 0 ? null : proximas;
}

export interface ChecklistNotice {
  tone: 'amber' | 'muted';
  text: string;
}

/**
 * O que a tela precisa DIZER embaixo da lista. Aviso ausente é como "configurei e não
 * funciona" nasce.
 */
export function checklistNotices(questions: string[], required?: string[]): ChecklistNotice[] {
  const perguntas = (questions ?? []).map((q) => (q ?? '').trim()).filter(Boolean);
  const itens = checklistItems(questions, required);
  const avisos: ChecklistNotice[] = [];

  if (perguntas.length === 0 && itens.length === 0) {
    avisos.push({
      tone: 'amber',
      text: 'Você ainda não escreveu nenhuma pergunta de qualificação, então não há o que exigir: neste cenário a IA entrega o lead como sempre entregou. Escreva as perguntas acima e volte para marcar as obrigatórias.',
    });
    return avisos;
  }

  if ((required ?? []).length === 0) {
    avisos.push({
      tone: 'amber',
      text: 'Nenhuma marcada, então TODAS valem como obrigatórias. Marque só as que realmente seguram o lead — exigir a lista inteira faz muito lead travar no orçamento e só chegar ao corretor quando ele mesmo pedir a visita.',
    });
  }

  const orfas = itens.filter((i) => i.orphan);
  if (orfas.length > 0) {
    avisos.push({
      tone: 'amber',
      text: `${orfas.length === 1 ? 'Uma pergunta obrigatória não está mais' : `${orfas.length} perguntas obrigatórias não estão mais`} na sua lista acima (você a reescreveu ou apagou). Ela continua segurando o lead e continua sendo perguntada — desmarque se não quiser mais.`,
    });
  }

  avisos.push({
    tone: 'muted',
    text: 'Lead que pede a visita, quer marcar dia e hora ou fala em fechar passa na hora, mesmo faltando pergunta. Lead irritado, que pede uma pessoa ou que percebeu que é IA também.',
  });

  return avisos;
}
