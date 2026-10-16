import { Label } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { ActionEditor, type AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
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

export function NotificationFields({ config, onChange, resources }: {
  config: FlowNodeConfig;
  onChange(next: FlowNodeConfig): void;
  resources: AutomationResources;
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
          onChange={e => onChange(withNotifyChoice(config, { quem: e.target.value as NotifyWho, onde: choice.onde }))}
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
            onChange={e => onChange(withNotifyChoice(config, { quem: choice.quem, onde: e.target.value as NotifyVia }))}
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
