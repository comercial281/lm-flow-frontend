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
 */

const TEMP_CLASSE: Record<string, string> = {
  hot: 'bg-red-500/20 text-red-300',
  warm: 'bg-amber-500/20 text-amber-300',
  cold: 'bg-sky-500/20 text-sky-300',
};

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
    <div className="mb-6 rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/5 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
          <Brain className="h-4 w-4 text-[#9333EA]" />
          O que a IA já descobriu
        </div>
        {briefing.temperature_label && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              TEMP_CLASSE[briefing.temperature ?? ''] ?? 'bg-white/10 text-white/70'
            }`}
          >
            {briefing.temperature_label}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {linhas.map(l => (
          <div key={l.label} className="flex justify-between gap-2 text-xs">
            <span className="text-white/50 flex-shrink-0">{l.label}</span>
            <span className="text-white/90 text-right break-words">{l.value}</span>
          </div>
        ))}
      </div>

      {campos.length > 0 && (
        <div className="mt-3 border-t border-[#7C3AED]/20 pt-2 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Ela já perguntou</p>
          {campos.map(c => (
            <div key={c.key} className="flex justify-between gap-2 text-xs">
              <span className="text-white/50 flex-shrink-0">{c.label}</span>
              <span className="text-white/90 text-right break-words">{c.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* As perguntas que a imobiliária exige antes de o lead ser entregue. Elas
          ficavam gravadas e não apareciam em tela nenhuma — e são exatamente o que
          o corretor não quer perguntar de novo. */}
      {checklist.length > 0 && (
        <div className="mt-3 border-t border-[#7C3AED]/20 pt-2 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Respostas do lead</p>
          {checklist.map(c => (
            <div key={c.question} className="flex justify-between gap-2 text-xs">
              <span className="text-white/50 flex-shrink-0">{c.question}</span>
              <span className="text-white/90 text-right break-words">{c.answer}</span>
            </div>
          ))}
        </div>
      )}

      {briefing.summary && (
        <p className="mt-3 rounded bg-black/20 p-2 text-xs text-white/80">{briefing.summary}</p>
      )}

      {briefing.handoff_reason && (
        <p className="mt-2 text-xs text-amber-300/90">Motivo do repasse: {briefing.handoff_reason}</p>
      )}
    </div>
  );
}
