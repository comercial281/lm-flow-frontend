import { useNavigate } from 'react-router-dom';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import PlaybookSection from '@/components/salesAgents/PlaybookSection';
import { type SalesAgent, type SalesAgentMode } from '@/services/salesAgents/salesAgentsService';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { Seletor } from '@/components/base/Seletor';
import { type InboxOption } from '../comum';
import { TriggersSection } from './TriggersSection';
import { BantSection } from './BantSection';
import { RecepcaoSection } from './RecepcaoSection';
import { VisitSection } from './VisitSection';
import { IntelligenceSection } from './IntelligenceSection';
import { ScheduleSection } from './ScheduleSection';
import { LimitsSection } from './LimitsSection';
import { AudioSection } from './AudioSection';
import { ReactionSection } from './ReactionSection';
import { FollowupSection } from './FollowupSection';
import { AdvancedSection } from './AdvancedSection';

export const MODE_LABELS: Record<SalesAgentMode, string> = {
  seller: 'Vendedora completa',
  sdr: 'Só qualifica (SDR)',
  assistant: 'Assistente do corretor',
};

const MODE_HELP: Record<SalesAgentMode, string> = {
  seller: 'Conversa, tira dúvidas com a base, qualifica e passa o lead quente pro corretor.',
  sdr: 'Faz as perguntas de qualificação e já passa o lead qualificado pro corretor.',
  assistant: 'Não fala com o lead. Sugere a resposta e resume o lead pro corretor (nota interna).',
};

// ---------------- Config ----------------

// O antigo "Configurar a IA por formulário" (seis perguntas num modal, tudo
// gerado pela IA) saiu em 2026-09-04: virou o assistente em tela cheia, por
// etapas, que grava direto nos campos (`assistente/AssistenteIA.tsx`).

export default function ConfigLegado({
  agent, inboxes, saving, onChange, onSave,
}: {
  agent: SalesAgent;
  inboxes: InboxOption[];
  saving: boolean;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const questionsText = (agent.qualification_questions ?? []).join('\n');
  const navigate = useNavigate();
  // Estreia fechada e liberada imobiliária por imobiliária: quem reescreve um
  // bloco muda como a IA atende TODOS os leads daquele cliente. A Leal Mídia
  // sempre vê, mesmo com a chave desligada (`isSuper ||`, como a aba de Landings —
  // sem ele a seção ficava escondida até de quem libera).
  const isSuper = useIsSuperAdmin();
  const roteiroToggle = useClientToggle('ia_playbook');
  const roteiroLiberado = isSuper || roteiroToggle;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/ia-vendedora/${agent.id}/assistente`)}>
          <Sparkles className="h-3.5 w-3.5" /> Abrir o assistente
        </Button>
      </div>
      <div>
        <Label>Como a IA atua</Label>
        <div className="grid grid-cols-1 gap-2 mt-1">
          {(Object.keys(MODE_LABELS) as SalesAgentMode[]).map((m) => (
            <label
              key={m}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer ${
                agent.mode === m ? 'border-primary bg-primary/5' : 'border-sidebar-border'
              }`}
            >
              <input type="radio" name="mode" className="mt-1" checked={agent.mode === m} onChange={() => onSave({ mode: m })} />
              <div>
                <div className="text-sm font-medium">{MODE_LABELS[m]}</div>
                <div className="text-xs text-muted-foreground">{MODE_HELP[m]}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="inbox">Número de WhatsApp que ela opera</Label>
        <Seletor
          id="inbox"
          value={agent.inbox_id ?? ''}
          onChange={(e) => onSave({ inbox_id: e.target.value || null })}
          className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
        >
          <option value="">— Selecione o canal —</option>
          {inboxes.map((i) => (
            <option key={i.id} value={String(i.id)}>{i.name}</option>
          ))}
        </Seletor>
        <p className="text-xs text-muted-foreground mt-1">Escolha o número de WhatsApp onde a IA vai operar: ela recebe e responde os leads por esse número.</p>
        {/* Sem canal a IA não é candidata a conversa nenhuma — a seleção filtra por
            inbox. Ligada e sem canal é o pior estado possível: parece pronta e não é. */}
        {agent.enabled && !agent.inbox_id && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
            <span>
              Esta IA está <strong>ligada, mas sem canal</strong> — ela não vai responder
              ninguém. Escolha o número acima para ela começar a atender.
            </span>
          </div>
        )}
      </div>

      {/* Mais de um agente no mesmo canal é permitido (ex: um só pro lançamento X,
          outro pro resto). Antes disso a escolha era aleatória e podia trocar de
          agente no meio da conversa; agora quem tem gatilho específico ganha, e a
          prioridade desempata. */}
      <div>
        <Label htmlFor="priority">Prioridade neste canal</Label>
        <Input
          id="priority"
          type="number"
          className="mt-1 w-32"
          value={agent.priority ?? 0}
          onChange={(e) => onChange({ ...agent, priority: Number(e.target.value) })}
          onBlur={() => onSave({ priority: Number(agent.priority) || 0 })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Só importa se houver mais de uma IA no mesmo canal: quem tem gatilho específico atende primeiro e, em caso de empate, o número maior ganha. Uma vez que uma IA assume a conversa, ela continua até a transferência.
        </p>
      </div>

      <div>
        <Label htmlFor="keyword">Palavra-chave de ativação (opcional)</Label>
        <Input
          id="keyword"
          placeholder="Ex: fluxoimob"
          value={agent.trigger_keyword ?? ''}
          onChange={(e) => onChange({ ...agent, trigger_keyword: e.target.value })}
          onBlur={() => onSave({ trigger_keyword: (agent.trigger_keyword ?? '').trim() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Se preenchido, a IA só entra na conversa quando o lead mandar essa palavra. Vazio = atende todo lead do canal. Ótimo pra testar sem afetar todos os leads.
        </p>
        {/* Este campo é um gatilho que mora FORA da lista de gatilhos abaixo.
            Quem apaga a lista inteira achando que liberou a IA pra todo mundo
            continua preso na palavra, sem nada na tela dizendo isso. */}
        {(agent.trigger_keyword ?? '').trim() !== '' && (
          <p className="text-xs text-amber-600 mt-1">
            Atenção: enquanto este campo estiver preenchido, a IA <strong>não</strong> atende todo lead do canal, mesmo que
            você exclua todos os gatilhos da lista abaixo. Deixe o campo vazio para ela atender todo mundo.
          </p>
        )}
      </div>

      <TriggersSection agent={agent} onSave={onSave} />

      <div>
        <Label htmlFor="role">Quem ela é (persona)</Label>
        <Input
          id="role"
          placeholder="Ex: consultora de imóveis da Imobiliária X"
          value={agent.persona_role ?? ''}
          onChange={(e) => onChange({ ...agent, persona_role: e.target.value })}
          onBlur={() => onSave({ persona_role: agent.persona_role })}
        />
      </div>

      <div>
        <Label htmlFor="goal">Objetivo dela</Label>
        <Input
          id="goal"
          placeholder="Ex: entender o que o lead procura e agendar uma visita"
          value={agent.persona_goal ?? ''}
          onChange={(e) => onChange({ ...agent, persona_goal: e.target.value })}
          onBlur={() => onSave({ persona_goal: agent.persona_goal })}
        />
      </div>

      <div>
        <Label htmlFor="instructions">Instruções (tom, regras, o que fazer)</Label>
        <Textarea
          id="instructions"
          rows={4}
          placeholder="Ex: fale de forma calorosa, sempre confirme o telefone, ofereça agendar visita..."
          value={agent.instructions ?? ''}
          onChange={(e) => onChange({ ...agent, instructions: e.target.value })}
          onBlur={() => onSave({ instructions: agent.instructions })}
        />
      </div>

      <div>
        <Label htmlFor="greeting">Primeira mensagem (opcional)</Label>
        <Textarea
          id="greeting"
          rows={2}
          placeholder="Ex: Oi! Vi que você se interessou por um imóvel. Posso te ajudar?"
          value={agent.greeting ?? ''}
          onChange={(e) => onChange({ ...agent, greeting: e.target.value })}
          onBlur={() => onSave({ greeting: agent.greeting })}
        />
      </div>

      <div>
        <Label htmlFor="questions">Perguntas de qualificação (uma por linha)</Label>
        <Textarea
          id="questions"
          rows={5}
          value={questionsText}
          onChange={(e) => onChange({ ...agent, qualification_questions: e.target.value.split('\n') })}
          onBlur={() =>
            onSave({ qualification_questions: (agent.qualification_questions ?? []).map((q) => q.trim()).filter(Boolean) })
          }
        />
      </div>

      <div>
        <Label htmlFor="default_prop">Imóvel padrão (código da aba Imóveis)</Label>
        <Input
          id="default_prop"
          placeholder="Ex: ALMA"
          value={agent.default_property_code ?? ''}
          onChange={(e) => onChange({ ...agent, default_property_code: e.target.value })}
          onBlur={() => onSave({ default_property_code: (agent.default_property_code ?? '').trim().toUpperCase() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Pra agente de UM empreendimento: a IA sempre usa este imóvel da aba Imóveis (dados, preço, condições), mesmo sem código na mensagem. Deixe vazio pra ela detectar o imóvel por código/anúncio.
        </p>
      </div>

      <BantSection agent={agent} onChange={onChange} onSave={onSave} />
      <RecepcaoSection agent={agent} onChange={onChange} onSave={onSave} />
      {/*
        ⚠️ A chave vai LITERAL na chamada do useClientToggle. Os dois scanners do
        catálogo varrem o código por regex: trocar por uma constante tira a chave
        do catálogo no deploy seguinte, o painel de Funções deixa de oferecer o
        botão de liberar, e ninguém é avisado. Mesma armadilha das Landings.
      */}
      {roteiroLiberado && (
        <PlaybookSection agentId={agent.id} playbook={agent.playbook} onSave={onSave} />
      )}
      <VisitSection agent={agent} onChange={onChange} onSave={onSave} />
      <IntelligenceSection agent={agent} onChange={onChange} onSave={onSave} />
      <ScheduleSection agent={agent} onSave={onSave} />
      <LimitsSection agent={agent} onChange={onChange} onSave={onSave} />
      <AudioSection agent={agent} onChange={onChange} onSave={onSave} />
      <ReactionSection agent={agent} onSave={onSave} />
      <FollowupSection agent={agent} onChange={onChange} onSave={onSave} />
      <AdvancedSection agent={agent} onChange={onChange} onSave={onSave} />

      {saving && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</p>}
    </div>
  );
}
