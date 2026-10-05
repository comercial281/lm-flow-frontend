import { Input, Label } from '@/components/ui/ds';
import { type SalesAgent, type UsageLimits } from '@/services/salesAgents/salesAgentsService';

// ---------------- Limites de volume e uso ----------------

export function LimitsSection({ agent, onChange, onSave }: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const limits: UsageLimits = agent.usage_limits ?? {};
  const patch = (p: Partial<UsageLimits>) => onChange({ ...agent, usage_limits: { ...limits, ...p } });
  const commit = (p: Partial<UsageLimits>) => onSave({ usage_limits: { ...limits, ...p } });

  const numField = (
    key: keyof UsageLimits, label: string, help: string, id: string,
  ) => (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        placeholder="Sem limite"
        className="mt-1 w-40"
        value={limits[key] ?? ''}
        onChange={(e) => patch({ [key]: e.target.value === '' ? null : Number(e.target.value) } as Partial<UsageLimits>)}
        onBlur={() => commit({ [key]: limits[key] || null } as Partial<UsageLimits>)}
      />
      <p className="text-xs text-muted-foreground mt-1">{help}</p>
    </div>
  );

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="text-sm font-medium mb-1">Limites de volume e uso</div>
      <div className="text-xs text-muted-foreground mb-3">
        Tetos de VOLUME (diferente dos "Limites da IA" acima, que são de conteúdo). Uma conversa já em andamento
        nunca é cortada, mesmo com o teto batido — só a entrada de lead NOVO para. Vazio = sem limite.
      </div>
      <div className="space-y-3">
        {numField('max_new_leads_per_day', 'Máx. de leads novos por dia', 'Depois desse número de leads NOVOS no dia, a IA para de puxar conversa nova (quem já está conversando continua).', 'lim_leads')}
        {numField('max_active_conversations', 'Máx. de conversas ativas ao mesmo tempo', 'Teto de conversas em aberto que a IA está tocando ao mesmo tempo.', 'lim_conv')}
        {numField('daily_budget_usd', 'Orçamento diário (US$)', 'Quando o gasto do dia (mesma conta dos números do Painel) bate este valor, a IA para de atender lead novo até o dia seguinte.', 'lim_budget')}
      </div>
    </div>
  );
}
