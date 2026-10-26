// TEXTOS DA AUTOMAÇÃO NO DISPARO (passo 2, spec 23/10/2026): a prévia de uma
// linha, o aviso de dado que só o gatilho traz e as linhas do resumo "Quem
// recebe". O nome do bloco e o tempo do Esperar vêm dos mesmos formatadores do
// construtor (palette.ts, waitTime.ts), pra o disparo falar como o canvas.
import type { AutomationOption, FlowSummary } from '@/services/broadcasts/broadcastsService';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { blockLabel } from '@/features/flowAutomations/palette';
import { describeSeconds, leadWaitSeconds } from '@/features/flowAutomations/waitTime';
import { dataHora, plural } from '@/lib/formato';

export interface LinhaDoResumo {
  chave: 'primeira' | 'passou' | 'rodando';
  texto: string;
  ajuda?: string;
  caixinha?: { marcada: boolean };
}

/** Modos em que a automação sai sempre pelo número dela (o do passo 1 não vale). */
const COM_NUMERO_PROPRIO: ReadonlyArray<AutomationOption['number_mode']> = ['fixed', 'personal'];

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

/** As linhas do resumo "Quem recebe" (linha com zero não aparece). */
export function linhasDoResumo(
  s: FlowSummary,
  escolhas: { incluirQuemPassou: boolean; recomecarRodando: boolean },
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
  return linhas;
}
