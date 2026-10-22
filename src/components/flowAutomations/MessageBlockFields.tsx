import type React from 'react';
import { Input, Label, Checkbox } from '@/components/ui/ds';
import SendFromField from '@/components/numbers/SendFromField';
import MessageSequenceEditor, {
  type ExtraSequenceKind,
  type VariableBarRender,
} from '@/components/messaging/MessageSequenceEditor';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { draftsOf, withItems } from '@/features/flowAutomations/messageItems';
import { applySendFrom, sendFromOf } from '@/features/numbers/sendFrom';
import { cleanProgressPrefix, progressOf, progressTagName, withProgress } from '@/features/flowAutomations/progress';
import { saiPeloWhatsAppDe } from '@/features/flowAutomations/personal';
import type { FlowNodeConfig } from '@/types/flowAutomations';
import type { TemplateVariable } from '@/types/messageFunnels';
import { SaiPeloSeuWhatsApp } from './SaiPeloSeuWhatsApp';
import { VariableChipBar } from './VariableChipBar';

// O bloco Mensagem (PR 8 do redesenho, 16/10/2026): uma sequência de itens no
// MESMO editor do Disparo em massa (texto, mídia, contato, espera e, fora do
// funil de conversa, o book do imóvel). Grava em `config.items`; o bloco
// antigo, sem `items`, abre como sequência de 1 item e só é regravado quando a
// pessoa mexe nele e salva.

// Fora do render: referência fixa (o editor não redesenha à toa).
const NO_VARIABLES: TemplateVariable[] = [];
const NO_EXTRA: ExtraSequenceKind[] = [];
const BOOK_EXTRA: ExtraSequenceKind[] = ['property_book'];
const variableBar: VariableBarRender = p => <VariableChipBar targetRef={p.targetRef} value={p.value} onChange={p.onChange} />;
const uploadMedia = (file: File) => flowAutomationsService.uploadMedia(file).then(url => ({ url }));

/** "Marcar progresso" do bloco Mensagem (sprint 3). */
export function ProgressFields({ config, onChange }: { config: FlowNodeConfig; onChange: (next: FlowNodeConfig) => void }) {
  const mark = progressOf(config);
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={mark.on}
          onCheckedChange={v => onChange(withProgress(config, { ...mark, on: v === true }))}
        />
        Marcar progresso
      </label>
      {mark.on && (
        <div className="pl-6 space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nome da etiqueta</Label>
              <Input
                value={mark.prefix}
                onChange={e => onChange(withProgress(config, { ...mark, prefix: cleanProgressPrefix(e.target.value) }))}
                placeholder="follow-up-longo"
                aria-label="Nome da etiqueta de progresso"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem nº</Label>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={mark.step}
                onChange={e => onChange(withProgress(config, { ...mark, step: Number(e.target.value) || 1 }))}
                aria-label="Número da mensagem"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Quando esta mensagem sai, o lead ganha a etiqueta{' '}
            <strong>{progressTagName(mark.prefix || 'nome', mark.step)}</strong> e perde a da mensagem anterior. É ela que
            faz o lead que volta ao fluxo continuar de onde parou.
          </p>
        </div>
      )}
    </div>
  );
}

interface EnvioPessoal {
  /** Automação pessoal do corretor: a mensagem sai pelo WhatsApp dele. */
  pessoal?: boolean;
  /** Telefone do número principal do corretor. */
  numeroPessoal?: string | null;
  /** O número do corretor ainda está carregando. */
  numeroPessoalCarregando?: boolean;
  /** Pessoal de OUTRA pessoa aberta pelo gestor: o nome do dono ('' sem nome). */
  donoDoEnvio?: string | null;
}

/** Por qual WhatsApp sai a mensagem da automação pessoal (sem escolha de número). */
export function LinhaDoEnvio({ pessoal = false, numeroPessoal = null, numeroPessoalCarregando = false, donoDoEnvio = null }: EnvioPessoal) {
  if (pessoal) return <SaiPeloSeuWhatsApp phone={numeroPessoal} loading={numeroPessoalCarregando} />;
  return <p className="text-sm font-medium" data-testid="sai-pelo-whatsapp-do-dono">{saiPeloWhatsAppDe(donoDoEnvio)}</p>;
}

interface Props extends EnvioPessoal {
  config: FlowNodeConfig;
  /** O `setConfig` do painel: as mudanças vão sobre o rascunho mais novo. */
  onChange: React.Dispatch<React.SetStateAction<FlowNodeConfig>>;
  /** Funil de conversa: sai pelo número da conversa, sem book nem progresso. */
  conversation?: boolean;
  /** Modo guiado: o corretor só ajusta o que o gestor montou. */
  guided?: boolean;
}

export function MessageBlockFields({
  config, onChange, conversation = false, guided = false, pessoal = false, numeroPessoal = null,
  numeroPessoalCarregando = false, donoDoEnvio = null,
}: Props) {
  const peloDono = pessoal || donoDoEnvio != null;
  return (
    <>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          Toque numa variável pra pôr o dado do lead no texto, onde o cursor estiver.
        </p>
        <MessageSequenceEditor
          items={draftsOf(config)}
          onChange={drafts => onChange(c => withItems(c, drafts))}
          variables={NO_VARIABLES}
          variableBar={variableBar}
          uploadMedia={uploadMedia}
          extraKinds={conversation ? NO_EXTRA : BOOK_EXTRA}
          guided={guided}
        />
      </div>
      {conversation ? (
        <p className="text-xs text-muted-foreground">Sai pelo número da conversa em que você disparar o funil.</p>
      ) : (
        <>
          {peloDono ? (
            <LinhaDoEnvio
              pessoal={pessoal}
              numeroPessoal={numeroPessoal}
              numeroPessoalCarregando={numeroPessoalCarregando}
              donoDoEnvio={donoDoEnvio}
            />
          ) : (
            <SendFromField
              scope="lead_automation_rules"
              value={sendFromOf(config)}
              onChange={v => onChange(c => applySendFrom(c, v))}
            />
          )}
          <ProgressFields config={config} onChange={onChange} />
          <p className="text-xs text-muted-foreground">A mensagem sai marcada como automática, igual o Follow-up.</p>
        </>
      )}
    </>
  );
}
