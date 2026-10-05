// Configurar. Na entrega 1 é a página de configuração de sempre, inteira e sem
// mudança (`ConfigLegado`), com o nome e a caixinha "Ativa" que ficavam no
// cabeçalho da tela antiga. A entrega 2 troca pelo passo a passo.
import { Input } from '@/components/ui/ds';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { InboxOption } from '../configuracao/comum';
import ConfigLegado from '../configuracao/legado/ConfigLegado';

export interface TelaConfigurarProps {
  agent: SalesAgent;
  inboxes: InboxOption[];
  saving: boolean;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}

export default function TelaConfigurar({ agent, inboxes, saving, onChange, onSave }: TelaConfigurarProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Nome da IA"
          value={agent.name}
          onChange={(e) => onChange({ ...agent, name: e.target.value })}
          onBlur={() => onSave({ name: agent.name })}
          className="text-lg font-semibold w-64"
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={agent.enabled}
            onChange={(e) => onSave({ enabled: e.target.checked })}
          />
          {agent.enabled ? 'Ativa' : 'Desativada'}
        </label>
      </div>
      <ConfigLegado agent={agent} inboxes={inboxes} saving={saving} onChange={onChange} onSave={onSave} />
    </div>
  );
}
