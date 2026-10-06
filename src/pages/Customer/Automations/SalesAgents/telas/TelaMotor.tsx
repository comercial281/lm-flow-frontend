// Motor (onda 3, 06/10/2026): o Avançado de antes, fora do Configurar, no "⋯".
// Equipe da plataforma: tudo (modelo, base, ritmo, follow-up aos poucos, limites,
// o texto que a IA recebe, reescrever o roteiro). Cliente com `ia_playbook`: só o
// texto que a IA recebe e a reescrita (o servidor aceita a reescrita desse cliente
// e ignora o resto — contrato 8 da onda 1). Grava na hora, como as páginas.
//
// ⚠️ `useClientToggle('ia_playbook')` LITERAL: os scanners do catálogo leem por regex.
// ⚠️ Limite em dinheiro (`usage_limits.daily_budget_usd`) não aparece e fica intacto:
// o limite grava por subchave.
// ⚠️ Trocar o modelo passa pelo Tony (memória "consultar antes de trocar modelo"):
// a lista só mostra; quem troca é a equipe, depois do ok dele.
import { useState } from 'react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import LinhaComChave from '@/components/base/LinhaComChave';
import PlaybookSection from '@/components/salesAgents/PlaybookSection';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';
import { useGravarNaHora } from '../configurar/useGravarNaHora';
import TextoNaHora from '../configurar/TextoNaHora';
import { MODELOS } from '../configurar/opcoes';

const numero = (v: string) => Math.max(0, Number(v) || 0);
const limite = (v: string) => (Number(v) > 0 ? Number(v) : null);

export default function TelaMotor({ agent, aoSalvo }: { agent: SalesAgent; aoSalvo: (a: SalesAgent) => void }) {
  const equipe = useIsSuperAdmin();
  const roteiroToggle = useClientToggle('ia_playbook');
  const roteiroLiberado = equipe || roteiroToggle;
  const { gravar } = useGravarNaHora(agent, aoSalvo);
  const [texto, setTexto] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [falhaTexto, setFalhaTexto] = useState<string | null>(null);
  const limites = agent.usage_limits ?? {};
  const modeloConhecido = MODELOS.some(([id]) => id === agent.model);

  const verTexto = async () => {
    setLendo(true);
    setFalhaTexto(null);
    try {
      setTexto((await salesAgentsService.testPrompt(agent.id)).prompt);
    } catch (e) {
      setFalhaTexto(motivoEscrito(e) ?? 'Não deu pra montar o texto agora. Tente de novo.');
    } finally {
      setLendo(false);
    }
  };

  // A reescrita de blocos grava na hora, como sempre gravou, e só o `playbook`.
  const salvarRoteiro = async (patch: Partial<SalesAgent>) => {
    aoSalvo(await salesAgentsService.update(agent.id, { playbook: patch.playbook }));
  };

  return (
    <Secoes>
      {equipe && (
        <>
          <Secao titulo="Modelo de IA" descricao="Equilíbrio entre inteligência e custo. Trocar o modelo passa pelo dono do produto.">
            <Campo id="motor-modelo" rotulo="Modelo de IA">
              <Seletor id="motor-modelo" className={`${CLASSE_DO_CAMPO} w-full`} value={modeloConhecido ? agent.model : ''}
                onChange={(e) => e.target.value && void gravar({ model: e.target.value })}>
                {!modeloConhecido && <option value="">Personalizado: {agent.model}</option>}
                {MODELOS.map(([id, rotulo]) => <option key={id} value={id}>{rotulo}</option>)}
              </Seletor>
            </Campo>
            <TextoNaHora id="motor-base" tipo="numero" min={500} rotulo="Quanto da base de conhecimento ela lê por resposta"
              salvo={String(agent.max_context_tokens ?? 4000)} aoGravar={(v) => gravar({ max_context_tokens: numero(v) })} />
          </Secao>

          <Secao titulo="Ritmo" descricao="Prioridade quando há mais de uma IA no número, espera pra juntar as mensagens do lead e o teto de mensagens por resposta.">
            <TextoNaHora id="motor-prioridade" tipo="numero" rotulo="Prioridade no número" ajuda="Só importa com mais de uma IA no mesmo número: o número maior atende primeiro."
              salvo={String(agent.priority ?? 0)} aoGravar={(v) => gravar({ priority: Number(v) || 0 })} />
            <TextoNaHora id="motor-espera" tipo="numero" min={0} max={120} rotulo="Espera antes de responder (segundos)"
              salvo={String(agent.reply_delay_seconds ?? 10)} aoGravar={(v) => gravar({ reply_delay_seconds: numero(v) })} />
            <TextoNaHora id="motor-partes" tipo="numero" min={2} max={4} rotulo="No máximo quantas mensagens por resposta"
              salvo={String(agent.message_split_max_parts ?? 3)} aoGravar={(v) => gravar({ message_split_max_parts: Math.min(4, Math.max(2, Number(v) || 3)) })} />
          </Secao>

          <Secao titulo="Follow-up aos poucos" descricao="Ela entrega um punhado de leads por vez, com pausa sorteada entre um punhado e outro. Protege o número.">
            <LinhaComChave rotulo="Ir aos poucos, como gente" ligada={agent.followup_drip_enabled !== false}
              aoMudar={(v) => gravar({ followup_drip_enabled: v })}>
              <div className="grid gap-4 md:grid-cols-2">
                <TextoNaHora id="motor-min-leads" tipo="numero" min={1} max={20} rotulo="Leads por vez (mínimo)" salvo={String(agent.followup_drip_min_leads ?? 2)} aoGravar={(v) => gravar({ followup_drip_min_leads: numero(v) })} />
                <TextoNaHora id="motor-max-leads" tipo="numero" min={1} max={20} rotulo="Leads por vez (máximo)" salvo={String(agent.followup_drip_max_leads ?? 3)} aoGravar={(v) => gravar({ followup_drip_max_leads: numero(v) })} />
                <TextoNaHora id="motor-min-min" tipo="numero" min={1} max={240} rotulo="Pausa (mínimo de minutos)" salvo={String(agent.followup_drip_min_minutes ?? 3)} aoGravar={(v) => gravar({ followup_drip_min_minutes: numero(v) })} />
                <TextoNaHora id="motor-max-min" tipo="numero" min={1} max={240} rotulo="Pausa (máximo de minutos)" salvo={String(agent.followup_drip_max_minutes ?? 5)} aoGravar={(v) => gravar({ followup_drip_max_minutes: numero(v) })} />
              </div>
            </LinhaComChave>
          </Secao>

          <Secao titulo="Limites por dia" descricao="Vazio = sem limite. Conversa já em andamento nunca é cortada.">
            <div className="grid gap-4 md:grid-cols-2">
              <TextoNaHora id="motor-novas" tipo="numero" min={0} rotulo="Conversas novas por dia" salvo={limites.max_new_leads_per_day ? String(limites.max_new_leads_per_day) : ''}
                aoGravar={(v) => gravar({ usage_limits: { ...limites, max_new_leads_per_day: limite(v) } }, ['usage_limits.max_new_leads_per_day'])} />
              <TextoNaHora id="motor-ativas" tipo="numero" min={0} rotulo="Conversas ao mesmo tempo" salvo={limites.max_active_conversations ? String(limites.max_active_conversations) : ''}
                aoGravar={(v) => gravar({ usage_limits: { ...limites, max_active_conversations: limite(v) } }, ['usage_limits.max_active_conversations'])} />
            </div>
          </Secao>
        </>
      )}

      <Secao titulo="O texto que a IA recebe" descricao="Montado a partir das escolhas desta IA, a cada resposta. Só leitura.">
        <Button type="button" variant="outline" onClick={() => void verTexto()} disabled={lendo}>
          {lendo ? 'Montando…' : 'Ver o texto que a IA recebe'}
        </Button>
        {falhaTexto && <p className="text-sm text-amber-700 dark:text-amber-400">{falhaTexto}</p>}
        {/* Só aqui a rolagem própria é de propósito: o texto tem milhares de linhas (fora do Configurar). */}
        {texto && <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">{texto}</pre>}
      </Secao>

      {roteiroLiberado && (
        <Secao titulo="Reescrever partes do roteiro" descricao="Muda como ela atende todos os leads desta imobiliária.">
          <PlaybookSection agentId={agent.id} playbook={agent.playbook} onSave={salvarRoteiro} />
        </Secao>
      )}
    </Secoes>
  );
}
