// MENSAGENS PRONTAS da conversa (12/10/2026, modelo Zap Voice): os funis de
// conversa separados por tipo. Funil de UM passo só, que é uma mensagem, faz o
// papel do "item único" do Zap Voice (um texto, um áudio, uma foto); o resto é
// funil. A regra lê a mesma prévia do "Disparar funil" (`funnelPreview`).
//
// Sem os blocos na lista (servidor sem o `with_nodes`), tudo cai em Funil e a
// prévia é buscada ao abrir.

import type { FlowAutomation } from '@/types/flowAutomations';
import type { FlowTemplatePreviewStep } from './templates';
import { funnelPreview } from './funnelPreview';
import { describeSeconds } from './waitTime';

export type TipoPronto = 'mensagem' | 'audio' | 'midia' | 'funil';

export const TIPOS_PRONTOS: { tipo: TipoPronto; rotulo: string }[] = [
  { tipo: 'mensagem', rotulo: 'Mensagens' },
  { tipo: 'audio', rotulo: 'Áudios' },
  { tipo: 'midia', rotulo: 'Mídias' },
  { tipo: 'funil', rotulo: 'Funis' },
];

const ehEnvio = (s: FlowTemplatePreviewStep) => s.kind === 'send_whatsapp' || s.kind === 'contact';

/** O tipo pela sequência: um passo só, de envio, vira Mensagem/Áudio/Mídia. */
export function tipoDaSequencia(passos: FlowTemplatePreviewStep[]): TipoPronto {
  if (passos.length !== 1 || !ehEnvio(passos[0])) return 'funil';
  const [passo] = passos;
  if (passo.media_kind === 'audio') return 'audio';
  if (passo.media_kind || passo.media_source) return 'midia';
  return 'mensagem';
}

export interface ItemPronto {
  funil: FlowAutomation;
  tipo: TipoPronto;
  /** Null = a lista veio sem os blocos (a prévia é buscada ao abrir). */
  passos: FlowTemplatePreviewStep[] | null;
}

export function itemPronto(funil: FlowAutomation): ItemPronto {
  if (!funil.nodes) return { funil, tipo: 'funil', passos: null };
  const passos = funnelPreview(funil);
  return { funil, tipo: tipoDaSequencia(passos), passos };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "3 mensagens · 2 dias" (o tempo some sem espera). */
export function resumoDoFunil(passos: FlowTemplatePreviewStep[] | null, contagem?: number): string {
  if (!passos) return contagem != null ? plural(contagem, 'mensagem', 'mensagens') : '';
  const mensagens = passos.filter(ehEnvio).length;
  const espera = passos.reduce((total, s) => total + (s.kind === 'wait' ? s.seconds ?? 0 : 0), 0);
  const partes = [plural(mensagens, 'mensagem', 'mensagens')];
  if (espera > 0) partes.push(describeSeconds(espera));
  return partes.join(' · ');
}
