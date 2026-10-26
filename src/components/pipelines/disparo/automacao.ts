// TEXTOS DA AUTOMAÇÃO NO DISPARO (passo 2, spec 23/10/2026): a prévia de uma
// linha, o aviso de dado que só o gatilho traz e as linhas do resumo "Quem
// recebe". O nome do bloco e o tempo do Esperar vêm dos mesmos formatadores do
// construtor (palette.ts, waitTime.ts), pra o disparo falar como o canvas.
import type { AudiencePreviewFull, AutomationOption, FlowSummary } from '@/services/broadcasts/broadcastsService';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { blockLabel } from '@/features/flowAutomations/palette';
import { describeSeconds, leadWaitSeconds } from '@/features/flowAutomations/waitTime';
import { dataHora, plural } from '@/lib/formato';

export interface LinhaDoResumo {
  chave: 'primeira' | 'passou' | 'rodando' | 'fora';
  texto: string;
  ajuda?: string;
  caixinha?: { marcada: boolean };
}

/** Modos em que a automação sai sempre pelo número dela (o do passo 1 não vale). */
const COM_NUMERO_PROPRIO: ReadonlyArray<AutomationOption['number_mode']> = ['fixed', 'personal'];

export const SEM_NUMERO_DO_FLUXO = 'Escolha o número nas Configurações da automação pra poder disparar.';
export const NUMERO_NAO_DISPARA = 'O número da automação não envia disparo. Troque nas Configurações da automação.';

/**
 * Por que a automação não pode ser disparada (null = pode). Número por bloco
 * (legado) e número próprio que não envia disparo: o servidor manda o
 * `inbox_id` nulo e recusaria no Disparar, então a tela trava antes.
 */
export function motivoSemDisparo(opt: AutomationOption): string | null {
  if (opt.number_mode === 'per_block') return SEM_NUMERO_DO_FLUXO;
  if (COM_NUMERO_PROPRIO.includes(opt.number_mode) && !opt.inbox_id) return NUMERO_NAO_DISPARA;
  return null;
}

/** O nome do número da automação, quando ela tem um; senão null (usa o do passo 1). */
export function numeroProprio(opt: AutomationOption): string | null {
  if (!COM_NUMERO_PROPRIO.includes(opt.number_mode)) return null;
  return opt.inbox_name || null;
}

function rotuloDoPrimeiroBloco(step: AutomationOption['first_step']): string {
  const config = step.config ?? {};
  const nome = blockLabel({ kind: step.kind ?? '', config } as Pick<FlowAutomationNode, 'kind' | 'config'>);
  if (step.kind !== 'wait') return nome;
  if (config.mode === 'date') return config.target_at ? `${nome} até ${dataHora(config.target_at)}` : nome;
  return `${nome} ${describeSeconds(leadWaitSeconds(config))}`;
}

/** 'Primeira mensagem: "Oi {{nome}}"' ou 'Começa com: Esperar 10 minutos' (sem o "e mais"). */
export function inicioDaPrevia(opt: AutomationOption): string {
  const texto = opt.first_step.kind === 'send_whatsapp' ? (opt.first_step.text ?? '').trim() : '';
  if (texto) return `Primeira mensagem: "${texto}"`;
  return `Começa com: ${rotuloDoPrimeiroBloco(opt.first_step)}`;
}

/** "e mais 8 blocos" (null quando não vem nada depois do primeiro). */
export function maisBlocos(opt: AutomationOption): string | null {
  return opt.more_blocks > 0 ? `e mais ${plural(opt.more_blocks, 'bloco', 'blocos')}` : null;
}

/** A prévia inteira em uma linha: 'Primeira mensagem: "..." · e mais 8 blocos'. */
export function linhaDaPrevia(opt: AutomationOption): string {
  const mais = maisBlocos(opt);
  return mais ? `${inicioDaPrevia(opt)} · ${mais}` : inicioDaPrevia(opt);
}

const DADO_DO_GATILHO: Record<AutomationOption['trigger_data'][number], string> = {
  visita: 'visita',
  formulario: 'formulário',
  imovel: 'imóvel do anúncio',
};

/** "visita, formulário e imóvel do anúncio". */
function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/** Aviso de dado que só o gatilho traz (no disparo não há gatilho). Null = sem aviso. */
export function avisoDoGatilho(dados: AutomationOption['trigger_data']): string | null {
  const nomes = dados.map(d => DADO_DO_GATILHO[d]).filter(Boolean);
  if (nomes.length === 0) return null;
  return `Essa automação usa dados de ${juntar(nomes)}. No disparo eles vêm vazios.`;
}

/**
 * "42 ficaram de fora: 2 pediram pra parar, 40 são de outros corretores" (só o
 * que não é zero). Passo 1 conta também quem já está na automação ou já passou
 * por ela; o resumo da automação (passo 2) já fala disso nas outras linhas e
 * chama com `comAutomacao` falso.
 */
export function linhaDeFora(excluded: AudiencePreviewFull['excluded'], comAutomacao = true): string | null {
  const partes: Array<readonly [number, string, string]> = [
    [excluded.opt_out, 'pediu pra parar', 'pediram pra parar'],
    [excluded.frequency, 'já recebeu nos últimos 7 dias', 'já receberam nos últimos 7 dias'],
    [excluded.other_owner, 'é de outro corretor', 'são de outros corretores'],
    [excluded.busy, 'já está em outra régua', 'já estão em outra régua'],
  ];
  if (comAutomacao) {
    partes.push(
      [excluded.in_this_flow ?? 0, 'já está nessa automação', 'já estão nessa automação'],
      [excluded.already_passed ?? 0, 'já passou por essa automação', 'já passaram por essa automação'],
    );
  }
  const total = partes.reduce((soma, [n]) => soma + n, 0);
  if (total === 0) return null;
  const motivos = partes.filter(([n]) => n > 0).map(([n, um, varios]) => plural(n, um, varios));
  return `${plural(total, 'ficou de fora', 'ficaram de fora')}: ${motivos.join(', ')}`;
}

/** As linhas do resumo "Quem recebe" (linha com zero não aparece). */
export function linhasDoResumo(
  s: FlowSummary,
  escolhas: { incluirQuemPassou: boolean; recomecarRodando: boolean; deFora?: string | null },
): LinhaDoResumo[] {
  const linhas: LinhaDoResumo[] = [];
  const um = (n: number) => n === 1;

  if (s.first_time > 0) {
    linhas.push({
      chave: 'primeira',
      texto: `${s.first_time} ${um(s.first_time) ? 'recebe' : 'recebem'} pela primeira vez.`,
    });
  }
  if (s.passed > 0) {
    linhas.push({
      chave: 'passou',
      texto: um(s.passed)
        ? `${s.passed} já passou por essa automação e recebe de novo`
        : `${s.passed} já passaram por essa automação e recebem de novo`,
      ...(s.passed_error > 0 && { ajuda: `${s.passed_error} com erro no envio da vez passada.` }),
      caixinha: { marcada: escolhas.incluirQuemPassou },
    });
  }
  if (s.running > 0) {
    linhas.push({
      chave: 'rodando',
      texto: um(s.running)
        ? `${s.running} está com essa automação rodando agora. Recomeçar pra ele`
        : `${s.running} estão com essa automação rodando agora. Recomeçar pra eles`,
      ajuda: um(s.running)
        ? 'Desmarcado, fica de fora. Marcado, a automação dele para e começa de novo.'
        : 'Desmarcado, ficam de fora. Marcado, a automação deles para e começa de novo.',
      caixinha: { marcada: escolhas.recomecarRodando },
    });
  }
  if (escolhas.deFora) linhas.push({ chave: 'fora', texto: escolhas.deFora });
  return linhas;
}

/**
 * As frases do passo Revisar, dentro do resumo do disparo (não aviso solto).
 * "Inclui N que já passaram por ela" só com a caixinha marcada; "Recomeça pra N
 * que estavam com ela rodando" idem. Sem escolha ou com zero, não há frase.
 */
export function frasesDaRevisao(
  s: FlowSummary | null,
  escolhas: { incluirQuemPassou: boolean; recomecarRodando: boolean },
): string[] {
  if (!s) return [];
  const frases: string[] = [];
  if (escolhas.incluirQuemPassou && s.passed > 0) {
    frases.push(s.passed === 1 ? `Inclui ${s.passed} que já passou por ela` : `Inclui ${s.passed} que já passaram por ela`);
  }
  if (escolhas.recomecarRodando && s.running > 0) {
    frases.push(
      s.running === 1
        ? `Recomeça pra ${s.running} que estava com ela rodando`
        : `Recomeça pra ${s.running} que estavam com ela rodando`,
    );
  }
  return frases;
}
