// Ensinar · o que antes ficava no Configurar: instruções, prova social e exemplos de
// conversa (decisão do dono do produto: um lugar só pra ensinar a IA). Rascunho com
// Salvar (exceção consciente da onda 3: o resto da IA grava na hora): salva só o que mudou.
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import BarraSalvar from '@/components/base/BarraSalvar';
import { Secao, Secoes } from '@/components/base/Secao';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import type { SalesAgent, SalesAgentExample } from '@/services/salesAgents/salesAgentsService';
import { useRascunho } from './useRascunho';
import { CAMPOS_DE_ENSINAR } from '../../configurar/camposDaIa';

export default function EnsinarTextos({ agent, aoSalvo }: { agent: SalesAgent; aoSalvo: (a: SalesAgent) => void }) {
  const { rascunho, mudar, pendente, salvando, erro, salvar, descartar } = useRascunho(agent, CAMPOS_DE_ENSINAR, aoSalvo);
  const exemplos = rascunho.example_conversations ?? [];
  const trocar = (i: number, p: Partial<SalesAgentExample>) =>
    mudar({ example_conversations: exemplos.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  return (
    <div className="space-y-3">
      <Secoes>
        <Secao titulo="Instruções" descricao="Regras e jeito de atender desta imobiliária. Valem acima do estilo padrão.">
          <CampoTextoLongo id="en-instrucoes" rotulo="Instruções" rows={5} valor={rascunho.instructions ?? ''}
            aoMudar={(v) => mudar({ instructions: v.trim() ? v : null })} />
        </Secao>
        <Secao titulo="Prova social" descricao="Casos reais que ela pode citar pra gerar confiança. Ela só cita o que estiver aqui.">
          <CampoTextoLongo id="en-prova" rotulo="Prova social" rows={3} valor={rascunho.social_proof ?? ''}
            aoMudar={(v) => mudar({ social_proof: v.trim() ? v : null })} />
        </Secao>
        <Secao titulo="Exemplos de conversa" descricao="Trechos que deram certo: o que o lead disse e como um bom corretor respondeu. Ela aprende o ritmo, não copia.">
          {exemplos.map((ex, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border p-3">
              <CampoTexto id={`en-ex-${i}-lead`} rotulo={`O que o lead disse (exemplo ${i + 1})`} valor={ex.lead ?? ''}
                aoMudar={(v) => trocar(i, { lead: v })} />
              <CampoTextoLongo id={`en-ex-${i}-resposta`} rotulo={`Como respondeu (exemplo ${i + 1})`} rows={2} valor={ex.resposta ?? ''}
                aoMudar={(v) => trocar(i, { resposta: v })} />
              <Button type="button" variant="ghost" size="sm" aria-label={`Excluir exemplo ${i + 1}`}
                onClick={() => mudar({ example_conversations: exemplos.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => mudar({ example_conversations: [...exemplos, { lead: '', resposta: '' }] })}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar exemplo
          </Button>
        </Secao>
      </Secoes>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <BarraSalvar visivel={pendente} salvando={salvando} aoSalvar={() => void salvar()} aoDescartar={descartar} />
    </div>
  );
}
