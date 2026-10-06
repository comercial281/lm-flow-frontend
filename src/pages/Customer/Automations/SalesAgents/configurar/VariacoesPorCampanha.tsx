// Variações da primeira mensagem por campanha (as "recepções por campanha" de antes,
// `openings`): a IA usa a primeira que combinar com a origem, o formulário ou a
// palavra que o lead mandou; senão, a primeira mensagem padrão.
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { CampoTexto, CampoTextoLongo } from '@/components/base/Campo';
import type { SalesAgentOpening } from '@/services/salesAgents/salesAgentsService';
import { CampoDeMidia } from './CampoDeMidia';

const paraLista = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

// Texto separado por vírgula, gravado ao sair do campo: gravar a cada tecla comia a
// vírgula que a pessoa acabou de digitar.
function CampoDeLista({ id, rotulo, valores, aoMudar }: { id: string; rotulo: string; valores?: string[]; aoMudar: (v: string[]) => void }) {
  const [texto, setTexto] = useState((valores ?? []).join(', '));
  useEffect(() => setTexto((valores ?? []).join(', ')), [valores]);
  return <CampoTexto id={id} rotulo={rotulo} valor={texto} aoMudar={setTexto} onBlur={() => aoMudar(paraLista(texto))} />;
}

export function VariacoesPorCampanha({ agentId, variacoes, aoMudar, rotuloDoTexto = 'Texto de base desta campanha' }: {
  agentId: string;
  variacoes: SalesAgentOpening[];
  aoMudar: (v: SalesAgentOpening[]) => void;
  /** Muda com o modo da primeira mensagem (o grupo opcional "texto exato" passa "Texto exato desta campanha"). */
  rotuloDoTexto?: string;
}) {
  const trocar = (i: number, p: Partial<SalesAgentOpening>) => aoMudar(variacoes.map((v, j) => (j === i ? { ...v, ...p } : v)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Variações por campanha</p>
        <Button type="button" variant="outline" size="sm"
          onClick={() => aoMudar([...variacoes, { label: 'Nova campanha', origins: [], form_ids: [], keywords: [] }])}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar variação
        </Button>
      </div>
      {variacoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma. Ela usa a primeira mensagem padrão pra todos.</p>}
      {variacoes.map((v, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-end gap-2">
            <CampoTexto id={`p3-var-${i}-nome`} rotulo="Nome da variação" valor={v.label ?? ''} className="flex-1"
              aoMudar={(x) => trocar(i, { label: x })} />
            <Button type="button" variant="ghost" size="sm" aria-label={`Excluir variação ${i + 1}`}
              onClick={() => aoMudar(variacoes.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <CampoDeLista id={`p3-var-${i}-origens`} rotulo="Origens (separe por vírgula)" valores={v.origins} aoMudar={(x) => trocar(i, { origins: x })} />
          <CampoDeLista id={`p3-var-${i}-forms`} rotulo="Códigos dos formulários do Meta (separe por vírgula)" valores={v.form_ids} aoMudar={(x) => trocar(i, { form_ids: x })} />
          <CampoDeLista id={`p3-var-${i}-palavras`} rotulo="Palavras na primeira mensagem do lead (separe por vírgula)" valores={v.keywords} aoMudar={(x) => trocar(i, { keywords: x })} />
          <CampoTextoLongo id={`p3-var-${i}-texto`} rotulo={rotuloDoTexto} rows={2} valor={v.greeting ?? ''}
            aoMudar={(x) => trocar(i, { greeting: x })} ajuda="Vazio usa o texto padrão." />
          <CampoTextoLongo id={`p3-var-${i}-intencao`} rotulo="Pergunta de intenção desta campanha" rows={2} valor={v.intent_question ?? ''}
            aoMudar={(x) => trocar(i, { intent_question: x })} ajuda="Vazio usa a pergunta padrão." />
          <CampoDeMidia id={`p3-var-${i}-imagem`} agentId={agentId} tipo="image" rotulo="Imagem desta campanha" valor={v.image_url}
            aoMudar={(url) => trocar(i, { image_url: url ?? undefined })} />
          <CampoDeMidia id={`p3-var-${i}-audio`} agentId={agentId} tipo="audio" rotulo="Áudio desta campanha" valor={v.audio_url}
            aoMudar={(url) => trocar(i, { audio_url: url ?? undefined })} />
        </div>
      ))}
    </div>
  );
}
