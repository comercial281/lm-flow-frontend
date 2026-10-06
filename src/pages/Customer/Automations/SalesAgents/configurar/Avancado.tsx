// Avançado: o que o gestor VÊ e só a equipe da plataforma MUDA (decisão do dono do
// produto, opção "b"). Modelo (troca só com o ok da equipe), quanto da base ela lê,
// prioridade no número, espera antes de responder, máximo de mensagens, follow-up
// aos poucos, limites por dia, o texto que a IA recebe (só leitura) e, pra equipe,
// reescrever parte do roteiro.
//
// ⚠️ `useClientToggle('ia_playbook')` LITERAL: os scanners do catálogo de
// funcionalidades leem o código por regex. Era assim no Configurar antigo e a
// regra de quem vê a reescrita continua a mesma (equipe ou cliente liberado).
//
// ⚠️ Limite em dinheiro (`usage_limits.daily_budget_usd`) não aparece (era em US$ e
// não há cotação pro cliente) e fica intacto no banco: o patch mescla por subchave.
import { useState } from 'react';
import { Button } from '@/components/ui/ds';
import BarraSalvar from '@/components/base/BarraSalvar';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CampoTexto, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import PlaybookSection from '@/components/salesAgents/PlaybookSection';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { motivoEscrito } from '@/features/salesAgents/erroDoServidor';
import { useRascunho } from './useRascunho';
import { CAMPOS_DO_PASSO } from './camposDosPassos';
import { Caixa } from './pecas';
import { MODELOS } from './opcoes';
import type { PropsDoPasso } from './passos';

const numero = (v: string) => Math.max(0, Number(v) || 0);
const limite = (v: string) => (Number(v) > 0 ? Number(v) : null);

export default function Avancado({ agent, aoSalvo }: PropsDoPasso) {
  const equipe = useIsSuperAdmin();
  const roteiroToggle = useClientToggle('ia_playbook');
  const roteiroLiberado = equipe || roteiroToggle;
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DO_PASSO.avancado, aoSalvo);
  const [texto, setTexto] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [falhaTexto, setFalhaTexto] = useState<string | null>(null);
  const travado = !equipe;
  const limites = rascunho.usage_limits ?? {};
  const modeloConhecido = MODELOS.some(([id]) => id === rascunho.model);

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

  // A reescrita de blocos salva na hora, como sempre salvou, e só o `playbook`.
  const salvarRoteiro = async (patch: Partial<SalesAgent>) => {
    aoSalvo(await salesAgentsService.update(agent.id, { playbook: patch.playbook }));
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Avançado</h1>
        <p className="text-sm text-muted-foreground">
          {travado ? 'Você vê como ela está ajustada. Só a equipe da plataforma muda estas opções.' : 'Ajustes da equipe da plataforma. O gestor vê sem poder mudar.'}
        </p>
      </header>

      <Secoes>
        <Secao titulo="Modelo de IA" descricao="Equilíbrio entre inteligência e custo. Trocar o modelo passa pela equipe.">
          <Campo id="av-modelo" rotulo="Modelo de IA">
            <Seletor id="av-modelo" className={`${CLASSE_DO_CAMPO} w-full`} disabled={travado} value={modeloConhecido ? rascunho.model : ''}
              onChange={(e) => mudar({ model: e.target.value })}>
              {!modeloConhecido && <option value="">Personalizado: {rascunho.model}</option>}
              {MODELOS.map(([id, rotulo]) => <option key={id} value={id}>{rotulo}</option>)}
            </Seletor>
          </Campo>
          <CampoTexto id="av-base" type="number" min={500} rotulo="Quanto da base de conhecimento ela lê por resposta" disabled={travado}
            valor={String(rascunho.max_context_tokens ?? 4000)} aoMudar={(v) => mudar({ max_context_tokens: numero(v) })} />
        </Secao>

        <Secao titulo="Ritmo" descricao="Prioridade quando há mais de uma IA no número, espera pra juntar as mensagens do lead e o teto de mensagens por resposta.">
          <CampoTexto id="av-prioridade" type="number" rotulo="Prioridade no número" disabled={travado}
            ajuda="Só importa com mais de uma IA no mesmo número: o número maior atende primeiro."
            valor={String(rascunho.priority ?? 0)} aoMudar={(v) => mudar({ priority: Number(v) || 0 })} />
          <CampoTexto id="av-espera" type="number" min={0} max={120} rotulo="Espera antes de responder (segundos)" disabled={travado}
            valor={String(rascunho.reply_delay_seconds ?? 10)} aoMudar={(v) => mudar({ reply_delay_seconds: numero(v) })} />
          <CampoTexto id="av-partes" type="number" min={2} max={4} rotulo="No máximo quantas mensagens por resposta" disabled={travado}
            valor={String(rascunho.message_split_max_parts ?? 3)}
            aoMudar={(v) => mudar({ message_split_max_parts: Math.min(4, Math.max(2, Number(v) || 3)) })} />
        </Secao>

        <Secao titulo="Follow-up aos poucos" descricao="Ela entrega um punhado de leads por vez, com pausa sorteada entre um punhado e outro. Protege o número.">
          <Caixa id="av-gotejar" rotulo="Ir aos poucos, como gente" marcada={rascunho.followup_drip_enabled !== false} desabilitada={travado}
            aoMudar={(v) => mudar({ followup_drip_enabled: v })} />
          <CampoTexto id="av-min-leads" type="number" min={1} max={20} rotulo="Leads por vez (mínimo)" disabled={travado}
            valor={String(rascunho.followup_drip_min_leads ?? 2)} aoMudar={(v) => mudar({ followup_drip_min_leads: numero(v) })} />
          <CampoTexto id="av-max-leads" type="number" min={1} max={20} rotulo="Leads por vez (máximo)" disabled={travado}
            valor={String(rascunho.followup_drip_max_leads ?? 3)} aoMudar={(v) => mudar({ followup_drip_max_leads: numero(v) })} />
          <CampoTexto id="av-min-min" type="number" min={1} max={240} rotulo="Pausa (mínimo de minutos)" disabled={travado}
            valor={String(rascunho.followup_drip_min_minutes ?? 3)} aoMudar={(v) => mudar({ followup_drip_min_minutes: numero(v) })} />
          <CampoTexto id="av-max-min" type="number" min={1} max={240} rotulo="Pausa (máximo de minutos)" disabled={travado}
            valor={String(rascunho.followup_drip_max_minutes ?? 5)} aoMudar={(v) => mudar({ followup_drip_max_minutes: numero(v) })} />
        </Secao>

        <Secao titulo="Limite por dia" descricao="Vazio = sem limite. Conversa já em andamento nunca é cortada.">
          <CampoTexto id="av-novas" type="number" min={0} rotulo="Conversas novas por dia" disabled={travado}
            valor={limites.max_new_leads_per_day ? String(limites.max_new_leads_per_day) : ''}
            aoMudar={(v) => mudar({ usage_limits: { ...limites, max_new_leads_per_day: limite(v) } })} />
          <CampoTexto id="av-ativas" type="number" min={0} rotulo="Conversas ao mesmo tempo" disabled={travado}
            valor={limites.max_active_conversations ? String(limites.max_active_conversations) : ''}
            aoMudar={(v) => mudar({ usage_limits: { ...limites, max_active_conversations: limite(v) } })} />
        </Secao>

        <Secao titulo="O texto que a IA recebe" descricao="Montado a partir das suas escolhas, a cada resposta. Só leitura: quem reescreve partes dele é a equipe da plataforma.">
          <Button type="button" variant="outline" onClick={() => void verTexto()} disabled={lendo}>
            {lendo ? 'Montando…' : 'Ver o texto que a IA recebe'}
          </Button>
          {falhaTexto && <p className="text-sm text-amber-700 dark:text-amber-400">{falhaTexto}</p>}
          {texto && <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">{texto}</pre>}
        </Secao>

        {roteiroLiberado && (
          <Secao titulo="Reescrever parte do roteiro" descricao="Só a equipe da plataforma. Muda como ela atende todos os leads desta imobiliária.">
            <PlaybookSection agentId={agent.id} playbook={agent.playbook} onSave={salvarRoteiro} />
          </Secao>
        )}
      </Secoes>

      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {!travado && <BarraSalvar visivel={pendente} salvando={salvando} aoSalvar={() => void salvar()} aoDescartar={descartar} />}
    </div>
  );
}
