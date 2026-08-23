import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Textarea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/ds';
import type { FlowAutomationNode, FlowNodeConfig } from '@/types/flowAutomations';
import { FLOW_NODE_DEF_BY_KIND } from '@/types/flowAutomations';

interface Props {
  node: FlowAutomationNode | null;
  onClose: () => void;
  onSave: (id: string, patch: { label: string; config: FlowNodeConfig }) => void;
}

const CONDITION_CRITERIA = [
  { value: 'replied', label: 'Respondeu a última mensagem' },
  { value: 'has_label', label: 'Tem etiqueta' },
  { value: 'at_stage', label: 'Está na etapa' },
  { value: 'has_email', label: 'Tem e-mail' },
  { value: 'has_phone', label: 'Tem telefone' },
  { value: 'came_from', label: 'Veio de' },
  { value: 'form_response', label: 'Resposta de formulário' },
];

// Modal de config de bloco — mirror do EditorDePasso/CamposDoPasso do Hub:
// rascunho local, só aplica em "Salvar". Um `switch(kind)` escolhe os campos
// certos por tipo, igual lá.
export function FlowNodeConfigModal({ node, onClose, onSave }: Props) {
  const [label, setLabel] = useState(node?.label || '');
  const [config, setConfig] = useState<FlowNodeConfig>(node?.config || {});

  React.useEffect(() => {
    setLabel(node?.label || '');
    setConfig(node?.config || {});
  }, [node?.id]);

  if (!node) return null;
  const activeNode = node; // const próprio pra narrowing sobreviver dentro de renderFields (função aninhada)
  const def = FLOW_NODE_DEF_BY_KIND[activeNode.kind];

  const set = (key: string, value: unknown) => setConfig(c => ({ ...c, [key]: value }));

  const textField = (key: string, placeholder: string, rows = 3) => (
    <div className="space-y-1">
      <Label className="text-xs">{placeholder}</Label>
      <Textarea rows={rows} value={(config[key] as string) || ''} onChange={e => set(key, e.target.value)} placeholder="{{nome}}" />
    </div>
  );

  const singleTextField = (key: string, placeholder: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{placeholder}</Label>
      <Input value={(config[key] as string) || ''} onChange={e => set(key, e.target.value)} />
    </div>
  );

  const labelsField = (key: string) => (
    <div className="space-y-1">
      <Label className="text-xs">Etiquetas (separadas por vírgula)</Label>
      <Input
        value={Array.isArray(config[key]) ? (config[key] as string[]).join(', ') : ''}
        onChange={e => set(key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
      />
    </div>
  );

  function renderFields() {
    switch (activeNode.kind) {
      case 'send_whatsapp':
      case 'notify_group':
        return (
          <>
            {textField('text', 'Mensagem')}
            {activeNode.kind === 'notify_group' && (
              <div className="space-y-1">
                <Label className="text-xs">Destinos (JID ou número, separados por vírgula)</Label>
                <Input
                  value={Array.isArray(config.targets) ? (config.targets as string[]).join(', ') : ''}
                  onChange={e => set('targets', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                />
              </div>
            )}
          </>
        );
      case 'send_email':
        return (
          <>
            {singleTextField('subject', 'Assunto')}
            {textField('text', 'Conteúdo (HTML permitido)', 6)}
          </>
        );
      case 'send_capi':
        return singleTextField('event_name', 'Nome do evento (ex: Lead, Purchase)');
      case 'notify_bell':
        return singleTextField('user_id', 'ID do usuário a notificar (vazio = responsável do card)');
      case 'funnel':
        return singleTextField('funnel_id', 'ID do funil de mensagens');
      case 'call_flow':
        return singleTextField('flow_automation_id', 'ID do fluxo a chamar');
      case 'add_label':
      case 'remove_label':
        return labelsField('labels');
      case 'create_pipeline_item':
        return (
          <>
            {singleTextField('pipeline_id', 'ID do funil (pipeline)')}
            {singleTextField('stage_id', 'ID da etapa (vazio = primeira)')}
          </>
        );
      case 'move_stage':
        return singleTextField('stage_id', 'ID da etapa de destino');
      case 'move_pipeline':
        return (
          <>
            {singleTextField('pipeline_id', 'ID do funil de destino')}
            {singleTextField('stage_id', 'ID da etapa (vazio = primeira)')}
          </>
        );
      case 'assign_owner':
        return singleTextField('user_id', 'ID do usuário responsável');
      case 'assign_round_robin':
        return (
          <div className="space-y-1">
            <Label className="text-xs">IDs dos usuários no rodízio (separados por vírgula)</Label>
            <Input
              value={Array.isArray(config.user_ids) ? (config.user_ids as string[]).join(', ') : ''}
              onChange={e => set('user_ids', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          </div>
        );
      case 'set_next_action':
        return (
          <>
            {singleTextField('text', 'Texto da próxima ação')}
            <div className="space-y-1">
              <Label className="text-xs">Daqui a quantas horas</Label>
              <Input type="number" value={(config.in_hours as number) ?? 24} onChange={e => set('in_hours', Number(e.target.value))} />
            </div>
          </>
        );
      case 'log_event':
        return textField('detail', 'Nota a registrar na linha do tempo');
      case 'wait':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Esperar quantos minutos</Label>
            <Input type="number" value={(config.minutes as number) ?? 1440} onChange={e => set('minutes', Number(e.target.value))} />
          </div>
        );
      case 'filter_label':
        return (
          <>
            {labelsField('labels')}
            <div className="space-y-1">
              <Label className="text-xs">Modo</Label>
              <Select value={(config.mode as string) || 'all'} onValueChange={v => set('mode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tem todas</SelectItem>
                  <SelectItem value="any">Tem qualquer uma</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );
      case 'wait_for_reply':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Prazo máximo (minutos)</Label>
            <Input type="number" value={(config.minutes as number) ?? 1440} onChange={e => set('minutes', Number(e.target.value))} />
          </div>
        );
      case 'condition':
        return (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Critério</Label>
              <Select value={(config.criterion as string) || 'replied'} onValueChange={v => set('criterion', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_CRITERIA.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {config.criterion === 'replied' && (
              <div className="space-y-1">
                <Label className="text-xs">Janela (horas)</Label>
                <Input type="number" value={(config.window_hours as number) ?? 24} onChange={e => set('window_hours', Number(e.target.value))} />
              </div>
            )}
            {config.criterion === 'has_label' && singleTextField('label', 'Etiqueta')}
            {config.criterion === 'at_stage' && singleTextField('stage_id', 'ID da etapa')}
            {config.criterion === 'came_from' && singleTextField('value', 'Texto a procurar na origem')}
            {config.criterion === 'form_response' && (
              <>
                {singleTextField('field', 'Campo do formulário')}
                {singleTextField('value', 'Valor esperado (vazio = só checa se respondeu)')}
              </>
            )}
          </>
        );
      case 'webhook':
        return singleTextField('event_name', 'Nome do evento');
      case 'http_call':
        return (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Método</Label>
              <Select value={(config.method as string) || 'POST'} onValueChange={v => set('method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {singleTextField('url', 'URL')}
            {textField('headers', 'Cabeçalhos (JSON)', 2)}
            {textField('body', 'Corpo (JSON, com {{variáveis}})', 4)}
          </>
        );
      case 'sequence':
        return <p className="text-xs text-muted-foreground">Os passos da sequência são editados na lista abaixo do canvas (em breve).</p>;
      default:
        return <p className="text-xs text-muted-foreground">Sem configuração adicional.</p>;
    }
  }

  return (
    <Dialog open={!!node} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{def?.label || activeNode.kind}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Apelido do bloco (opcional)</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={def?.label} />
          </div>
          {renderFields()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(activeNode.id, { label, config })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
