import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Seletor } from '@/components/base/Seletor';
import { pipelinesService } from '@/services/pipelines/pipelinesService';

interface Props {
  contactId: string;
  /** Conversa do lead, se tiver: colocar por ela grava a origem certa (anúncio / WhatsApp orgânico). */
  conversationId?: string | null;
  /** Entrou no funil: quem abriu o card recarrega e mostra o card de verdade. */
  onColocado: () => void;
}

// No lugar da Etapa, no card de quem não está em funil nenhum (card aberto de
// Contatos, spec 2026-10-02-fase-4-card-do-contato). Escolheu o funil, o
// contato entra na primeira coluna — o mesmo serviço do "Novo lead" do quadro.
// Com conversa, coloca pela conversa: pelo contato, lead de WhatsApp orgânico
// ficava gravado como Cadastro manual (achado da Frente 2, 07/10/2026).
export default function ColocarNoFunil({ contactId, conversationId, onColocado }: Props) {
  const [funis, setFunis] = useState<Array<{ id: string; name: string }> | null>(null);
  const [colocando, setColocando] = useState(false);

  useEffect(() => {
    let vivo = true;
    pipelinesService
      .getPipelines()
      .then(res => { if (vivo) setFunis((res?.data ?? []).map(p => ({ id: String(p.id), name: p.name }))); })
      .catch(() => { if (vivo) setFunis([]); });
    return () => { vivo = false; };
  }, []);

  const colocar = async (pipelineId: string) => {
    if (!pipelineId) return;
    setColocando(true);
    try {
      const etapas = (await pipelinesService.getPipelineStages(pipelineId))?.data ?? [];
      const primeira = [...etapas].sort((a, b) => a.position - b.position)[0];
      if (!primeira) {
        toast.error('Esse funil não tem nenhuma coluna ainda.');
        return;
      }
      await pipelinesService.addItemToPipeline(pipelineId, {
        item_id: conversationId ?? contactId,
        type: conversationId ? 'conversation' : 'contact',
        pipeline_stage_id: String(primeira.id),
      });
      toast.success('Contato colocado no funil.');
      onColocado();
    } catch (erro) {
      // Já estava lá (entrou sozinho pelo funil padrão nesse meio-tempo): só
      // recarregar mostra o card que existe.
      const e = erro as { response?: { data?: { error?: { message?: string }; message?: string } } };
      const msg = e?.response?.data?.error?.message || e?.response?.data?.message || '';
      if (/already in this pipeline/i.test(msg)) onColocado();
      else toast.error('Não consegui colocar o contato no funil.');
    } finally {
      setColocando(false);
    }
  };

  return (
    <div className="grid gap-1 min-w-0">
      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        Funil
        {colocando && <Loader2 className="h-3 w-3 animate-spin" />}
      </span>
      <Seletor
        aria-label="Colocar no funil"
        className="h-10 w-full text-sm"
        value=""
        disabled={colocando || funis === null || funis.length === 0}
        onChange={e => colocar(e.target.value)}
      >
        <option value="">{funis?.length === 0 ? 'Nenhum funil criado' : 'Colocar no funil'}</option>
        {(funis ?? []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
      </Seletor>
    </div>
  );
}
