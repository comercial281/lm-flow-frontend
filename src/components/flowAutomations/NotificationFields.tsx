import { Label } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { ActionEditor, type AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import { leadActionConfig, leadActionOf } from '@/features/flowAutomations/leadAction';
import {
  notifyChoiceOf, viasFor, withNotifyChoice, type NotifyVia, type NotifyWho,
} from '@/features/flowAutomations/notification';
import type { FlowNodeConfig } from '@/types/flowAutomations';

const QUEM: Array<[NotifyWho, string]> = [
  ['grupo', 'O grupo do WhatsApp'],
  ['pessoa', 'Uma pessoa da equipe'],
  ['corretor', 'O corretor do lead'],
  ['gestor', 'O gestor'],
];
const VIA: Array<[NotifyVia, string]> = [['whatsapp', 'WhatsApp'], ['app', 'Aviso no app']];

// Modo guiado (corretor): trocar o destino troca o `action_type`, que o servidor
// recusa (422). Os dois seletores ficam travados; os campos do tipo seguem.
export function NotificationFields({ config, onChange, resources, guided = false, storedConfig }: {
  config: FlowNodeConfig;
  onChange(next: FlowNodeConfig): void;
  resources: AutomationResources;
  guided?: boolean;
  /** A config gravada do bloco: voltar pro tipo dela devolve os campos dela. */
  storedConfig?: FlowNodeConfig;
}) {
  const action = leadActionOf(config);
  const choice = notifyChoiceOf(action.type);
  const vias = viasFor(choice.quem);
  return (
    <div className="space-y-4">
      <div>
        <Label>Avisar quem</Label>
        <Seletor
          value={choice.quem}
          onChange={e => onChange(withNotifyChoice(config, { quem: e.target.value as NotifyWho, onde: choice.onde }, storedConfig))}
          disabled={guided}
          className="mt-1 w-full"
          aria-label="Avisar quem"
        >
          {QUEM.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Seletor>
      </div>
      {vias.length > 1 && (
        <div>
          <Label>Por onde</Label>
          <Seletor
            value={choice.onde}
            onChange={e => onChange(withNotifyChoice(config, { quem: choice.quem, onde: e.target.value as NotifyVia }, storedConfig))}
            disabled={guided}
            className="mt-1 w-full"
            aria-label="Por onde"
          >
            {VIA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Seletor>
        </div>
      )}
      <ActionEditor
        action={action}
        onChange={a => onChange(leadActionConfig(a))}
        resources={resources}
      />
    </div>
  );
}
