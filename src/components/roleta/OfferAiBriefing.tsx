import { Brain } from 'lucide-react';

import type { OfferAiBriefing as Briefing } from '@/services/roletaConfig/brokerAssignmentsService';

/**
 * O que a IA já descobriu do lead, na tela de aceite da oferta.
 *
 * Esta é a tela em que o corretor DECIDE assumir o lead, e até aqui ela mostrava
 * nome, telefone e o prazo. Tudo o que a IA levantou conversando com o lead —
 * temperatura, o que ele quer, orçamento, região, prazo, o resumo — só existia no
 * bloco *O que a IA entendeu*, na lateral da conversa, que ele só alcança DEPOIS
 * de aceitar. Resultado: ele assumia o lead e perguntava tudo de novo.
 *
 * Aqui vai a ficha COMPLETA (a mensagem de WhatsApp leva três linhas). Quem monta
 * é o servidor: a mesma ficha alimenta o texto do WhatsApp, e duas montagens
 * divergiriam — "o WhatsApp diz uma coisa e a tela diz outra".
 *
 * Não desenha nada quando não há resumo: a roleta oferta lead de qualquer origem
 * (anúncio, formulário, portal, orgânico), e a maioria nunca falou com a IA.
 *
 * ⚠️ LARGURA É O DEFEITO DESTE BLOCO, e ele aparece primeiro no celular. Todo
 * texto aqui vem de fora (pergunta escrita pela imobiliária, resposta digitada
 * pelo lead) e não tem tamanho previsível. Ver as duas armadilhas marcadas nas
 * peças abaixo antes de mexer em qualquer classe de layout.
 */

const TEMP_CLASSE: Record<string, string> = {
  hot: 'bg-red-500/20 text-red-300',
  warm: 'bg-amber-500/20 text-amber-300',
  cold: 'bg-sky-500/20 text-sky-300',
};

/**
 * Uma linha "rótulo → valor", em duas colunas.
 *
 * ⚠️ O rótulo tem TETO de largura e o valor fica com o resto. Sem o teto (era
 * `flex-shrink-0` sozinho) um rótulo comprido ocupava a linha inteira e o valor
 * era espremido numa coluna de dois dedos: *2 quartos* quebrava em "2" / "quartos"
 * e VAZAVA para fora da borda do bloco. O `break-words` dos dois lados é a
 * segunda rede — palavra longa (um bairro composto, um e-mail) estoura a caixa
 * no celular sem ele.
 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="max-w-[45%] shrink-0 break-words text-white/50">{label}</span>
      <span className="min-w-0 flex-1 break-words text-right text-white/90">{value}</span>
    </div>
  );
}

interface Props {
  briefing?: Briefing | null;
}

export default function OfferAiBriefing({ briefing }: Props) {
  if (!briefing) return null;

  const linhas: Array<{ label: string; value: string }> = [];
  if (briefing.stage_label) linhas.push({ label: 'Etapa da conversa', value: briefing.stage_label });
  if (briefing.intent_label) linhas.push({ label: 'Interesse', value: briefing.intent_label });
  if (briefing.sentiment_label) linhas.push({ label: 'Como está se sentindo', value: briefing.sentiment_label });

  const campos = briefing.fields ?? [];
  const checklist = briefing.checklist ?? [];

  // Sem nada para mostrar, nem o cabeçalho aparece — cabeçalho sozinho parece
  // tela quebrada.
  const temAlgo =
    linhas.length > 0 || campos.length > 0 || checklist.length > 0 ||
    Boolean(briefing.summary) || Boolean(briefing.temperature_label);
  if (!temAlgo) return null;

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-white/90">
          <Brain className="h-4 w-4 shrink-0 text-[#9333EA]" />
          O que a IA já descobriu
        </div>
        {briefing.temperature_label && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              TEMP_CLASSE[briefing.temperature ?? ''] ?? 'bg-white/10 text-white/70'
            }`}
          >
            {briefing.temperature_label}
          </span>
        )}
      </div>

      {linhas.length > 0 && (
        <div className="space-y-1.5">
          {linhas.map(l => <Row key={l.label} label={l.label} value={l.value} />)}
        </div>
      )}

      {campos.length > 0 && (
        <div className={`${linhas.length > 0 ? 'mt-3 border-t border-[#7C3AED]/20 pt-3' : ''}`}>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">Ela já perguntou</p>
          <div className="space-y-1.5">
            {campos.map(c => <Row key={c.key} label={c.label} value={c.value} />)}
          </div>
        </div>
      )}

      {/* As perguntas que a imobiliária exige antes de o lead ser entregue. Elas
          ficavam gravadas e não apareciam em tela nenhuma — e são exatamente o que
          o corretor não quer perguntar de novo.

          ⚠️ AQUI É EMPILHADO, NUNCA em duas colunas. Os dois lados são frase
          inteira: a pergunta é escrita pela imobiliária e a resposta vem do lead.
          Lado a lado, um sempre espreme o outro — foi assim que *2 quartos*
          apareceu quebrado e fora da borda. A barra à esquerda é o que mantém
          pergunta e resposta lidas como um par só. */}
      {checklist.length > 0 && (
        <div className="mt-3 border-t border-[#7C3AED]/20 pt-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">Respostas do lead</p>
          <div className="space-y-2.5">
            {checklist.map(c => (
              <div key={c.question} className="border-l-2 border-[#7C3AED]/25 pl-2.5">
                <p className="break-words text-[11px] leading-snug text-white/45">{c.question}</p>
                <p className="mt-0.5 break-words text-xs leading-snug text-white/90">{c.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {briefing.summary && (
        <p className="mt-3 break-words rounded-lg bg-black/25 p-2.5 text-xs leading-relaxed text-white/80">
          {briefing.summary}
        </p>
      )}

      {briefing.handoff_reason && (
        <p className="mt-2 break-words rounded-lg border border-amber-400/25 bg-amber-400/5 p-2.5 text-xs leading-relaxed text-amber-200/90">
          <span className="text-amber-200/60">Motivo do repasse: </span>
          {briefing.handoff_reason}
        </p>
      )}
    </div>
  );
}
