import { useState } from 'react';
import { Label, Textarea } from '@/components/ui/ds';
import type { AgentPlaybookConfig, PlaybookVars } from '@/services/salesAgents/salesAgentsService';

// O que sobrou do "Roteiro da conversa" no Motor (fase 6, 01/11/2026).
//
// A reescrita de bloco e os pontos-chave (próximo passo, objeções) saíram: o servidor
// não lê mais bloco reescrito (`override_for` devolve nil), as objeções são as
// "Objeções da casa" (Regras da casa) e o próximo passo vem das opções do agente.
// Só a dor típica segue valendo (`linha_dor`). As outras chaves de `vars` têm dono em
// outras páginas (caminhos da intenção, tipo de venda, lead pronto): ao gravar,
// parte-se do que já está salvo e mexe-se só na dor.

const ROTULO = 'O que dói em quem procura vocês';

export default function PlaybookSection({
  playbook,
  onSave,
}: {
  /** O roteiro já gravado neste cliente. Chave ausente = padrão de fábrica. */
  playbook: AgentPlaybookConfig | undefined;
  onSave: (patch: { playbook: AgentPlaybookConfig }) => void;
}) {
  const current: AgentPlaybookConfig = playbook ?? {};
  const currentVars: PlaybookVars = typeof current.vars === 'object' && current.vars !== null ? current.vars : {};
  const [dor, setDor] = useState(currentVars.dor_tipica ?? '');

  // Vazio = HERDA o padrão: a chave sai do hash em vez de ir em branco.
  const gravar = () => {
    const cleaned: PlaybookVars = { ...currentVars };
    if (dor.trim()) cleaned.dor_tipica = dor.trim(); else delete cleaned.dor_tipica;
    if (JSON.stringify(cleaned) === JSON.stringify(currentVars)) return;
    const next: AgentPlaybookConfig = { ...current };
    if (Object.keys(cleaned).length) next.vars = cleaned; else delete next.vars;
    onSave({ playbook: next });
  };

  return (
    <div>
      <Label htmlFor="pv-dor" className="text-xs">{ROTULO}</Label>
      <Textarea
        id="pv-dor"
        rows={2}
        placeholder="Ex: paga aluguel caro e quer parar de jogar dinheiro fora"
        value={dor}
        onChange={(e) => setDor(e.target.value)}
        onBlur={gravar}
      />
      <p className="text-[11px] text-muted-foreground mt-1">
        Entra nas perguntas de problema e implicação. Em branco, a IA usa o método da casa.
      </p>
    </div>
  );
}
