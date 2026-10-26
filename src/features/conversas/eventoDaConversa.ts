import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Message } from '@/types/chat/api';
import { TEXTOS_DOS_EVENTOS as T } from './textosDosEventos';

export type FamiliaDoEvento = 'visita' | 'visita-encerrada' | 'tarefa' | 'ganho' | 'perdido';

export interface CartaoDoEvento {
  familia: FamiliaDoEvento;
  icone:
    | 'calendario'
    | 'calendario-ok'
    | 'calendario-x'
    | 'remarcar'
    | 'pessoa-x'
    | 'tarefa'
    | 'tarefa-ok'
    | 'trofeu'
    | 'x';
  titulo: string;
  principal?: string;
  riscado?: boolean;
  detalhe?: string;
  estrelas?: number;
  comentario?: string;
  rodape?: string;
  rodapeIa?: boolean;
}

export interface PilulaDoEvento {
  icone: 'check' | 'estrela' | 'remarcar';
  nome?: string;
  texto: string;
  estrelas?: number;
}

type Evento = Record<string, unknown>;

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;

// "Sábado, 25 out às 17h" / "Sábado, 25 out às 17h30" (fuso do navegador)
function formatarData(iso: unknown): string | undefined {
  const s = texto(iso);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  const base = format(d, "EEEE, d MMM 'às' H'h'", { locale: ptBR }).replace(/\./g, '');
  const min = d.getMinutes();
  const out = min === 0 ? base : `${base}${String(min).padStart(2, '0')}`;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

const juntar = (...partes: (string | undefined)[]): string | undefined => {
  const ok = partes.filter((p): p is string => !!p);
  return ok.length ? ok.join(' · ') : undefined;
};

interface Autoria {
  rodape?: string;
  rodapeIa?: boolean;
}

function rodapeDe(
  e: Evento,
  comPessoa: (nome: string) => string,
  ia?: string,
  automacao?: string,
  proposta?: string,
): Autoria {
  const by = texto(e.by);
  if (e.by_ai === true && ia) return { rodape: ia, rodapeIa: true };
  if (e.by_proposal === true && proposta) return { rodape: proposta };
  if (e.by_automation === true && automacao) return { rodape: automacao };
  if (by) return { rodape: comPessoa(by) };
  return {};
}

function cartaoDeVisita(tipo: string, e: Evento): CartaoDoEvento | null {
  const data = formatarData(e.scheduled_at);
  const imovel = texto(e.property);
  const corretor = texto(e.realtor);
  const R = T.rodapes;
  switch (tipo) {
    case 'visit_scheduled':
      return {
        familia: 'visita',
        icone: 'calendario',
        titulo: T.titulos.visitaAgendada,
        principal: data,
        detalhe: juntar(imovel, corretor && T.detalhes.com(corretor)),
        ...rodapeDe(e, R.agendadaPor, R.agendadaPelaIa),
      };
    case 'visit_rescheduled': {
      const anterior = formatarData(e.previous_scheduled_at);
      return {
        familia: 'visita',
        icone: 'remarcar',
        titulo: T.titulos.visitaRemarcada,
        principal: data,
        detalhe: anterior && T.detalhes.era(anterior),
        ...rodapeDe(e, R.remarcadaPor, R.remarcadaPelaIa),
      };
    }
    case 'visit_completed': {
      const rating = typeof e.rating === 'number' && e.rating > 0 ? e.rating : undefined;
      const feedback = texto(e.feedback);
      const retorno = rating !== undefined || feedback !== undefined;
      return {
        familia: 'visita',
        icone: 'calendario-ok',
        titulo: T.titulos.visitaRealizada,
        detalhe: imovel,
        estrelas: rating,
        comentario: feedback,
        ...rodapeDe(e, retorno ? R.retornoDe : R.registradaPor),
      };
    }
    case 'visit_no_show':
      return {
        familia: 'visita-encerrada',
        icone: 'pessoa-x',
        titulo: T.titulos.naoCompareceu,
        principal: data,
        detalhe: imovel,
        ...rodapeDe(e, R.registradoPor),
      };
    case 'visit_cancelled':
      return {
        familia: 'visita-encerrada',
        icone: 'calendario-x',
        titulo: T.titulos.visitaCancelada,
        principal: data && T.detalhes.era(data),
        detalhe: texto(e.reason),
        ...rodapeDe(e, R.canceladaPor),
      };
    default:
      return null;
  }
}

function cartaoDeTarefa(tipo: string, e: Evento): CartaoDoEvento | null {
  const R = T.rodapes;
  const titulo = texto(e.title);
  const responsavel = texto(e.assignee);
  if (tipo === 'task_created') {
    const prazo = formatarData(e.due_at);
    return {
      familia: 'tarefa',
      icone: 'tarefa',
      titulo: prazo ? T.titulos.tarefaAgendada : T.titulos.tarefaCriada,
      principal: titulo,
      detalhe: juntar(prazo, responsavel && T.detalhes.para(responsavel)),
      ...rodapeDe(e, R.criadaPor, undefined, R.criadaPelaAutomacao),
    };
  }
  if (tipo === 'task_completed') {
    const by = texto(e.by);
    const sufixo = e.on_time === true ? R.noPrazo : e.on_time === false ? R.atrasada : '';
    return {
      familia: 'tarefa',
      icone: 'tarefa-ok',
      titulo: T.titulos.tarefaConcluida,
      principal: titulo,
      riscado: true,
      rodape: by ? `${R.concluidaPor(by)}${sufixo}` : undefined,
    };
  }
  return null;
}

function cartaoDeNegocio(tipo: string, e: Evento): CartaoDoEvento | null {
  const R = T.rodapes;
  const funil = texto(e.pipeline);
  const imovel = texto(e.property);
  const autoria = rodapeDe(e, R.marcadoPor, undefined, R.pelaAutomacao, R.pelaProposta);
  if (tipo === 'deal_won') {
    return {
      familia: 'ganho',
      icone: 'trofeu',
      titulo: T.titulos.negocioGanho,
      principal: imovel ?? funil,
      detalhe: imovel ? funil : undefined,
      ...autoria,
    };
  }
  if (tipo === 'deal_lost') {
    const motivo = texto(e.reason);
    const etapa = texto(e.stage);
    return {
      familia: 'perdido',
      icone: 'x',
      titulo: T.titulos.negocioPerdido,
      principal: motivo ? T.detalhes.motivo(motivo) : funil,
      detalhe: juntar(funil, etapa && T.detalhes.saiuDaEtapa(etapa)),
      ...autoria,
    };
  }
  return null;
}

function limpar<O extends object>(o: O): O {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as O;
}

export function lerEvento(message: Message): { cartao: CartaoDoEvento } | { pilula: PilulaDoEvento } | null {
  const e = message.content_attributes?.event;
  if (!e || typeof e !== 'object') return null;
  const ev = e as Evento;
  const tipo = texto(ev.type);
  if (!tipo) return null;
  const nome = texto(ev.by);

  if (tipo === 'visit_confirmed') {
    const data = formatarData(ev.scheduled_at);
    return {
      pilula: limpar({
        icone: 'check' as const,
        nome,
        texto: data ? T.pilulas.confirmouVisita(data) : T.pilulas.confirmouVisita('').trim(),
      }),
    };
  }
  if (tipo === 'visit_feedback') {
    const rating = typeof ev.rating === 'number' ? ev.rating : undefined;
    return { pilula: limpar({ icone: 'estrela' as const, nome, texto: T.pilulas.deuRetorno, estrelas: rating }) };
  }
  if (tipo === 'deal_reopened') {
    return { pilula: limpar({ icone: 'remarcar' as const, nome, texto: T.pilulas.reabriuNegocio }) };
  }

  const cartao =
    cartaoDeVisita(tipo, ev) ?? cartaoDeTarefa(tipo, ev) ?? cartaoDeNegocio(tipo, ev);
  return cartao ? { cartao: limpar(cartao) } : null;
}
