/**
 * A Agenda do corretor está ligada? Quem diz é o SERVIDOR (`GET /visit_settings`):
 * `{ enabled: true, days, start, end, closed_dates, seeded_from }` ou
 * `{ enabled: false }`. A tela não lê mais chave nenhuma (a chave
 * `agenda_do_corretor` saiu do front em 01/10/2026): quando o servidor ligar
 * para todo mundo, a tela acompanha sem deploy.
 *
 * `ligada`: `null` enquanto não respondeu, `false` com `enabled: false`, 403 ou
 * qualquer erro (a tela de antes), `true` só com `enabled: true`.
 *
 * Um pedido só para a página inteira: a resposta fica guardada por pouco tempo
 * (cabeçalho da Agenda, modal e IA perguntam a mesma coisa). Quem muda o horário
 * de visita chama `esquecerAgendaLigada()` para o próximo a perguntar ler o novo.
 * A resposta guardada é da imobiliária do subdomínio (`getTenantSlug`): trocou
 * de imobiliária, pergunta de novo.
 */
import { useEffect, useState } from 'react';
import { agendaService } from '@/services/visits/agendaService';
import { getTenantSlug } from '@/services/core/tenant';
import type { AgendaSettings } from '@/features/visits/agenda';

export interface AgendaLigada {
  ligada: boolean | null;
  /** O horário de visita, só com `ligada === true`. */
  ajustes: AgendaSettings | null;
}

const VALIDADE_MS = 30_000;
const CARREGANDO: AgendaLigada = { ligada: null, ajustes: null };
const DESLIGADA: AgendaLigada = { ligada: false, ajustes: null };

let guardado: {
  em: number;
  slug: string | null;
  pedido: Promise<AgendaLigada>;
  valor: AgendaLigada | null;
} | null = null;

/** Joga fora a resposta guardada (depois de salvar o horário de visita; specs). */
export function esquecerAgendaLigada() {
  guardado = null;
}

function slugAtual(): string | null {
  try { return getTenantSlug() ?? null; } catch { return null; }
}

/** A resposta guardada, se ainda vale: dentro da validade e da mesma imobiliária. */
function fresco() {
  if (!guardado) return null;
  if (Date.now() - guardado.em >= VALIDADE_MS) return null;
  if (guardado.slug !== slugAtual()) return null;
  return guardado;
}

function perguntar(): Promise<AgendaLigada> {
  const atual = fresco();
  if (atual) return atual.pedido;
  const entrada: NonNullable<typeof guardado> = {
    em: Date.now(), slug: slugAtual(), pedido: Promise.resolve(CARREGANDO), valor: null,
  };
  // Dentro de um `then`: erro síncrono (ou retorno que não é promessa) cai no
  // `catch` abaixo e vira "desligada", nunca um erro solto.
  entrada.pedido = Promise.resolve()
    .then(() => agendaService.getSettings())
    .then((r): AgendaLigada => {
      if (!r || r.enabled !== true) return DESLIGADA;
      const { days, start, end, closed_dates, seeded_from } = r;
      return { ligada: true, ajustes: { days: days ?? [], start, end, closed_dates: closed_dates ?? [], seeded_from } };
    })
    .catch(() => {
      // Erro não fica guardado: a próxima tela pergunta de novo.
      if (guardado === entrada) guardado = null;
      return DESLIGADA;
    })
    .then(v => { entrada.valor = v; return v; });
  guardado = entrada;
  return entrada.pedido;
}

/**
 * `ativo = false` não pergunta (o modal fechado); ao virar `true`, pergunta de
 * novo se a resposta guardada venceu. Enquanto a nova não chega, fica a anterior.
 */
export function useAgendaLigada(ativo = true): AgendaLigada {
  const [estado, setEstado] = useState<AgendaLigada>(() => fresco()?.valor ?? CARREGANDO);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    perguntar().then(v => { if (vivo) setEstado(v); });
    return () => { vivo = false; };
  }, [ativo]);

  // Já respondido por outra tela: usa na hora, sem um quadro de "carregando".
  if (ativo && estado.ligada === null) return fresco()?.valor ?? estado;
  return estado;
}
