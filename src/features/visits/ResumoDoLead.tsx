// O bloco Lead da Agenda: o mesmo na prévia do hover (compacto) e na janela do
// clique (completo, com as respostas da IA, o resumo da IA e os botões). Desenho
// da prévia aprovada pelo Tony em 27/10/2026 (`resumoLead()`).
//
// Nada de texto cru do servidor: situação do card e autor da mensagem passam
// pelos mapas abaixo, datas pelo `@/lib/formato`. Data que não lê some (o
// formato devolve "—" e travessão não entra em tela).
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import { dataCurta, plural, telefone, tempoDesde, toDate } from '@/lib/formato';
import type { LeadSummary } from '@/services/visits/visitsService';

const SITUACAO_DO_CARD: Record<'open' | 'won' | 'lost', string> = {
  open: 'Em aberto',
  won: 'Ganho',
  lost: 'Perdido',
};

type Mensagem = NonNullable<LeadSummary['last_message']>;

function quemMandou(m: Mensagem, nomeDoLead: string | null): string {
  switch (m.author_kind) {
    case 'lead': return nomeDoLead || m.author_name || 'Lead';
    case 'ia': return 'IA Vendedora';
    case 'automacao': return 'Automação';
    default: return m.author_name || 'Alguém do time';
  }
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const [a, b] = [partes[0], partes.length > 1 ? partes[partes.length - 1] : ''];
  return (a[0] + (b[0] ?? '')).toUpperCase();
}

function visitasAntes(n: number | null): string | null {
  if (n == null) return null;
  return n === 0 ? 'Primeira visita' : `${n} antes desta`;
}

function desde(iso: string | null): string | null {
  if (!toDate(iso)) return null;
  return `${dataCurta(iso)} (${tempoDesde(iso as string)})`;
}

export function ResumoDoLead({ resumo, completo = false }: { resumo: LeadSummary; completo?: boolean }) {
  const nome = resumo.contact?.name?.trim() || null;
  const fone = telefone(resumo.contact?.phone_number);
  const card = resumo.card;
  // Em aberto é o normal: só Ganho e Perdido viram selo. Situação desconhecida some.
  const situacaoDoCard = card && card.status !== 'open' ? SITUACAO_DO_CARD[card.status] ?? null : null;
  const msg = resumo.last_message;
  const quandoMsg = msg && toDate(msg.created_at) ? tempoDesde(msg.created_at as string) : null;
  const ia = completo ? resumo.ia : null;
  const respostas = ia
    ? [
        ...ia.fields.map(f => ({ rotulo: f.label, valor: f.value })),
        ...ia.checklist.map(c => ({ rotulo: c.question, valor: c.answer })),
      ]
    : [];

  const linhas: Array<[string, string]> = [];
  if (resumo.origin_label) linhas.push(['Origem', resumo.origin_label]);
  if (resumo.owner?.name) linhas.push(['Corretor', resumo.owner.name]);
  const visitas = visitasAntes(resumo.previous_visits_count);
  if (visitas) linhas.push(['Visitas', visitas]);
  const noFunil = card ? desde(resumo.card_entered_at) : null;
  if (noFunil) linhas.push(['No funil desde', noFunil]);
  const chegou = completo ? desde(resumo.lead_created_at) : null;
  if (chegou) linhas.push(['Lead desde', chegou]);

  return (
    <div className="min-w-0 text-sm">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-muted text-[13px] font-semibold">
          {iniciais(nome ?? '')}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight lm-redact" title={nome ?? undefined}>{nome ?? 'Lead sem nome'}</p>
          {fone && <p className="text-xs tabular-nums text-muted-foreground lm-redact">{fone}</p>}
        </div>
      </div>

      {card && (card.pipeline_name || card.stage_name) && (
        <div className="mt-2.5">
          <div data-testid="funil-do-lead" className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {card.pipeline_name && <span>{card.pipeline_name}</span>}
            {card.pipeline_name && card.stage_name && <span aria-hidden className="text-muted-foreground">›</span>}
            {card.stage_name && <b className="font-semibold">{card.stage_name}</b>}
            {situacaoDoCard && <span className="text-muted-foreground">· {situacaoDoCard}</span>}
          </div>
          {card.other_cards_count > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Mais {plural(card.other_cards_count, 'card', 'cards')} deste lead
            </p>
          )}
        </div>
      )}

      {linhas.length > 0 && (
        <dl className={`mt-3 grid gap-x-2.5 gap-y-1 text-xs ${completo ? 'grid-cols-[96px_minmax(0,1fr)]' : 'grid-cols-[82px_minmax(0,1fr)]'}`}>
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="contents">
              <dt className="text-muted-foreground">{rotulo}</dt>
              <dd className="min-w-0 break-words">{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {resumo.labels.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {resumo.labels.map(l => (
            <span key={l.title} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: l.color }} />
              {l.title}
            </span>
          ))}
        </div>
      )}

      {msg && (
        <div className="mt-3 rounded-[10px] bg-muted px-3 py-2 text-[12.5px]">
          <div className="mb-0.5 flex justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="min-w-0 truncate">Última mensagem · {quemMandou(msg, nome)}</span>
            {quandoMsg && <span className="shrink-0">{quandoMsg}</span>}
          </div>
          {msg.content && <p className="break-words lm-redact">{msg.content}</p>}
        </div>
      )}

      {respostas.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Respostas da IA</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {respostas.map((r, i) => (
              <div key={`${r.rotulo}-${i}`} className="min-w-0 rounded-[9px] border border-border bg-card px-2.5 py-1.5">
                <small className="block break-words text-[10.5px] text-muted-foreground">{r.rotulo}</small>
                <b className="block break-words text-[12.5px] font-semibold">{r.valor}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {ia?.summary && (
        <div className="mt-3">
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Resumo da IA</p>
          <p className="break-words text-[12.5px]">{ia.summary}</p>
        </div>
      )}

      {completo && (resumo.conversation_id || resumo.contact?.id) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {resumo.conversation_id && (
            <Button asChild variant="outline" size="sm"><Link to={`/conversations/${resumo.conversation_id}`}>Abrir conversa</Link></Button>
          )}
          {resumo.contact?.id && (
            <Button asChild variant="outline" size="sm"><Link to={`/contacts/${resumo.contact.id}`}>Abrir card do lead</Link></Button>
          )}
        </div>
      )}
    </div>
  );
}
