import { Label, Textarea } from '@/components/ui/ds';
import { type SalesAgent, type BantConfig } from '@/services/salesAgents/salesAgentsService';
import { Toggle } from '../comum';

// ---------------- BANT (qualificação estruturada) ----------------

const BANT_DEFAULT_QUESTIONS: Record<keyof Pick<BantConfig, 'budget_question' | 'authority_question' | 'need_question' | 'timeline_question'>, string> = {
  budget_question: 'Qual faixa de investimento você tem em mente pra esse imóvel?',
  authority_question: 'Essa decisão é só sua ou mais alguém participa (cônjuge, sócio, família)?',
  need_question: 'O que está fazendo você procurar um imóvel agora?',
  timeline_question: 'Em quanto tempo pretende fechar negócio?',
};

export function BantSection({ agent, onChange, onSave }: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const cfg: BantConfig = agent.bant_config ?? {};
  const on = !!cfg.enabled;
  const patch = (p: Partial<BantConfig>) => onChange({ ...agent, bant_config: { ...cfg, ...p } });
  const commit = (p: Partial<BantConfig>) => onSave({ bant_config: { ...cfg, ...p } });

  const field = (key: keyof typeof BANT_DEFAULT_QUESTIONS, label: string) => (
    <div>
      <Label htmlFor={`bant_${key}`} className="text-xs">{label}</Label>
      <Textarea
        id={`bant_${key}`}
        rows={2}
        className="mt-1"
        placeholder={BANT_DEFAULT_QUESTIONS[key]}
        value={cfg[key] ?? ''}
        onChange={(e) => patch({ [key]: e.target.value } as Partial<BantConfig>)}
        onBlur={() => commit({ [key]: (cfg[key] ?? '').trim() || undefined } as Partial<BantConfig>)}
      />
    </div>
  );

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Qualificação BANT</div>
          <div className="text-xs text-muted-foreground">
            Budget, Authority, Need, Timeline: os 4 pontos que decidem se o lead está pronto pra avançar. A IA cobre
            os 4 ao longo da conversa (sem virar interrogatório) e registra o que descobrir.
          </div>
        </div>
        <Toggle on={on} onChange={(v) => onSave({ bant_config: { ...cfg, enabled: v } })} rotulo="qualificação BANT" />
      </div>

      {on && (
        <div className="mt-3 space-y-3 pl-1">
          {field('budget_question', 'Orçamento (Budget)')}
          {field('authority_question', 'Quem decide (Authority)')}
          {field('need_question', 'Necessidade real (Need)')}
          {field('timeline_question', 'Prazo (Timeline)')}

          <div>
            <Label htmlFor="bant_criteria" className="text-xs">Critério de qualificação</Label>
            <Textarea
              id="bant_criteria"
              rows={3}
              className="mt-1"
              placeholder="Ex: qualificado quando tem orçamento compatível com o imóvel E decide sozinho ou já envolveu quem decide E quer fechar em até 3 meses"
              value={cfg.qualify_criteria ?? ''}
              onChange={(e) => patch({ qualify_criteria: e.target.value })}
              onBlur={() => commit({ qualify_criteria: (cfg.qualify_criteria ?? '').trim() || undefined })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Escreva em texto livre o que torna um lead qualificado pra você. A IA usa isso pra marcar o lead como
              qualificado ou não (aparece como etiqueta na conversa). Vazio = ela nunca decide sozinha.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
