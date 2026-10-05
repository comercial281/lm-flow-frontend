import type { ScheduledAction } from '@/types/automation';

// ── AGENDADOS DO LEAD (04/10/2026) ───────────────────────────────────────────
//
// A seção "Agendados" do painel do lead (ao lado da conversa) mostra as
// mensagens agendadas pra este lead que ainda não saíram. As regras de texto e
// de quais entram moram aqui (com spec); o desenho, em
// components/chat/contact-sidebar/painel/SecaoAgendados.tsx.

export const TEXTOS_DOS_AGENDADOS = {
  titulo: 'Agendados',
  editar: 'Editar agendamento',
  cancelar: 'Cancelar agendamento',
  perguntaTitulo: 'Cancelar esta mensagem agendada?',
  perguntaDescricao: 'Ela não vai mais sair pra este lead. Se mudar de ideia, é só agendar de novo.',
  perguntaConfirmar: 'Cancelar mensagem',
  perguntaVoltar: 'Manter',
  cancelado: 'Mensagem agendada cancelada.',
  erroAoCancelar: 'Não foi possível cancelar o agendamento.',
  semTexto: 'Mensagem',
} as const;

const ROTULO_DA_MIDIA: Record<string, string> = {
  image: 'Imagem',
  audio: 'Áudio',
  video: 'Vídeo',
  document: 'Arquivo',
  sticker: 'Figurinha',
  contact: 'Contato',
};

const LIMITE = 60;

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

const encurtar = (frase: string, limite: number): string => {
  const uma = frase.replace(/\s+/g, ' ').trim();
  return uma.length > limite ? `${uma.slice(0, limite).trimEnd()}…` : uma;
};

type Item = { kind?: unknown; text_content?: unknown; media_caption?: unknown };

/**
 * O que a mensagem diz, curto: os primeiros ~60 caracteres do texto, ou o tipo
 * da mídia ("Imagem", "Áudio"...) com a legenda quando há. Sequência com mais
 * de uma mensagem ganha "(+N)".
 */
export function resumoDoAgendamento(acao: Pick<ScheduledAction, 'payload'>, limite = LIMITE): string {
  const payload = (acao.payload ?? {}) as Record<string, unknown>;
  const itens = (Array.isArray(payload.funnel_items) ? (payload.funnel_items as Item[]) : []).filter(
    it => it && it.kind !== 'delay',
  );

  if (itens.length === 0) {
    const mensagem = texto(payload.message);
    if (mensagem) return encurtar(mensagem, limite);
    const midia = ROTULO_DA_MIDIA[texto(payload.media_type)] ?? (texto(payload.media_url) ? 'Imagem' : '');
    return midia || TEXTOS_DOS_AGENDADOS.semTexto;
  }

  const [primeiro] = itens;
  const tipo = texto(primeiro.kind);
  let base: string;
  if (tipo === 'text') {
    base = encurtar(texto(primeiro.text_content), limite) || TEXTOS_DOS_AGENDADOS.semTexto;
  } else {
    const rotulo = ROTULO_DA_MIDIA[tipo] ?? TEXTOS_DOS_AGENDADOS.semTexto;
    const legenda = texto(primeiro.media_caption);
    base = legenda ? `${rotulo}: ${encurtar(legenda, limite)}` : rotulo;
  }
  return itens.length > 1 ? `${base} (+${itens.length - 1})` : base;
}

/** Só mensagem que ainda vai sair, a mais próxima primeiro. */
export function agendadosPendentes(lista: ScheduledAction[] | null | undefined): ScheduledAction[] {
  return (lista ?? [])
    .filter(a => a.status === 'scheduled' && a.action_type === 'send_message')
    .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
}

// ── Aviso de "mudou" ─────────────────────────────────────────────────────────
// Quem agenda (o "⋮" do topo da conversa, o card do lead) e quem mostra (o
// painel do lead) são irmãos na tela: um aviso no window evita subir estado
// até a página de Conversas só pra isso.
export const EVENTO_AGENDADOS_MUDARAM = 'lmflow:agendados-mudaram';

export function avisarAgendadosMudaram(contactId?: string | number | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(EVENTO_AGENDADOS_MUDARAM, { detail: { contactId: contactId != null ? String(contactId) : null } }),
  );
}
