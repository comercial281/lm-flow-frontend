import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { nodeColor } from '@/lib/flowAutomationGraph';
import { hasMessageContent } from '@/features/flowAutomations/messageItems';
import { paletteItems } from '@/features/flowAutomations/palette';
import type { FlowNodeConfig } from '@/types/flowAutomations';
import { FlowBlockDialog } from './FlowBlockDialog';
import { SequenciaDaMensagem } from './MessageBlockFields';

// "Adicionar mensagem" do follow-up com condições de retomada (04/11/2026): a
// janela só pede o conteúdo. A nova mensagem sai pelo número da anterior (o
// servidor decide), então não há escolha de número nem progresso aqui. Quem
// salva e religa as pontas é o servidor (addMessage), chamado pelo canvas.

interface Props {
  /** Corretor (modo guiado): a linha diz que sai pelo responsável pelo lead. */
  guided: boolean;
  salvando: boolean;
  aoSalvar: (config: FlowNodeConfig) => void;
  aoFechar: () => void;
}

/** O conteúdo inicial: a mesma mensagem em branco que o bloco Mensagem novo traz. */
function configInicial(): FlowNodeConfig {
  const item = paletteItems().find(i => i.kind === 'send_whatsapp');
  return item ? structuredClone(item.config) : { items: [] };
}

export function JanelaNovaMensagem({ guided, salvando, aoSalvar, aoFechar }: Props) {
  const [config, setConfig] = useState<FlowNodeConfig>(configInicial);
  // Lead nenhum recebe mensagem vazia.
  const podeSalvar = hasMessageContent(config) && !salvando;
  return (
    <FlowBlockDialog
      testId="janela-nova-mensagem"
      size="2xl"
      title="Adicionar mensagem"
      description="Entra no fim do follow-up, depois da última mensagem."
      icon={MessageSquarePlus}
      color={nodeColor('send_whatsapp', 'message')}
      onClose={() => { if (!salvando) aoFechar(); }}
      footer={(
        <>
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => aoSalvar(config)} disabled={!podeSalvar}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <SequenciaDaMensagem config={config} onChange={setConfig} guided={false} />
        {guided ? (
          <p className="text-sm font-medium" data-testid="sai-pelo-responsavel">Sai pelo WhatsApp do responsável pelo lead.</p>
        ) : (
          <p className="text-sm font-medium">Sai pelo mesmo número da mensagem anterior.</p>
        )}
      </div>
    </FlowBlockDialog>
  );
}

export default JanelaNovaMensagem;
