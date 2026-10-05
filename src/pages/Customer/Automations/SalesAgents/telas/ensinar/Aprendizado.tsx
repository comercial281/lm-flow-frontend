import { useEffect, useState, useCallback } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { salesAgentsService, type SalesAgent, type SalesAgentLesson, type SalesAgentLessonKind } from '@/services/salesAgents/salesAgentsService';

// ---------------- Knowledge ----------------

// ---------------- Aprendizado (feedback -> regras + exemplos) ----------------

const LESSON_KIND_LABEL: Record<SalesAgentLessonKind, string> = {
  rule: 'Regra',
  good_example: 'Exemplo bom',
  bad_example: 'Exemplo ruim',
};

export function LearningTab({ agent }: { agent: SalesAgent }) {
  const [lessons, setLessons] = useState<SalesAgentLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [rule, setRule] = useState('');
  const [busy, setBusy] = useState(false);
  // exemplo (bom ou ruim)
  const [exContext, setExContext] = useState('');
  const [exReply, setExReply] = useState('');
  const [exKind, setExKind] = useState<'good_example' | 'bad_example'>('good_example');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLessons(await salesAgentsService.listLessons(agent.id));
    } catch {
      toast.error('Erro ao carregar o aprendizado');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => { load(); }, [load]);

  const addRule = async () => {
    const c = rule.trim();
    if (!c) return;
    setBusy(true);
    try {
      await salesAgentsService.createLesson(agent.id, 'rule', c);
      setRule('');
      toast.success('Ensinado');
      await load();
    } catch {
      toast.error('Erro ao ensinar');
    } finally {
      setBusy(false);
    }
  };

  const addExample = async () => {
    const c = exReply.trim();
    if (!c) return;
    setBusy(true);
    try {
      await salesAgentsService.createLesson(agent.id, exKind, c, exContext.trim() || undefined);
      setExContext(''); setExReply('');
      toast.success('Exemplo salvo');
      await load();
    } catch {
      toast.error('Erro ao salvar exemplo');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await salesAgentsService.destroyLesson(agent.id, id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Ensine a IA com o tempo. Ela não re-treina o modelo: o que você escreve vira regra ou exemplo que ela passa a seguir nas próximas conversas.
      </p>

      {/* Ensinar por regra */}
      <div>
        <Label>Ensinar a IA (regra / correção)</Label>
        <Textarea
          rows={3}
          placeholder="Ex: sempre ofereça agendar uma visita. Nunca fale de preço antes de saber o orçamento. Seja mais informal."
          value={rule}
          onChange={(e) => setRule(e.target.value)}
        />
        <Button size="sm" className="mt-2" onClick={addRule} disabled={busy || !rule.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Ensinar
        </Button>
      </div>

      {/* Exemplo bom/ruim */}
      <div className="pt-2 border-t border-sidebar-border">
        <Label>Ensinar por exemplo</Label>
        <div className="flex gap-2 mt-1 mb-2">
          <button
            onClick={() => setExKind('good_example')}
            className={`px-3 py-1 rounded-md text-sm border ${exKind === 'good_example' ? 'border-primary bg-primary/5 text-primary' : 'border-sidebar-border'}`}
          >👍 Resposta boa</button>
          <button
            onClick={() => setExKind('bad_example')}
            className={`px-3 py-1 rounded-md text-sm border ${exKind === 'bad_example' ? 'border-primary bg-primary/5 text-primary' : 'border-sidebar-border'}`}
          >👎 Resposta ruim</button>
        </div>
        <Input className="mb-2" placeholder="O que o lead disse (opcional)" value={exContext} onChange={(e) => setExContext(e.target.value)} />
        <Textarea
          rows={2}
          placeholder={exKind === 'good_example' ? 'A resposta ideal que ela deveria dar' : 'A resposta que ela NÃO deve dar'}
          value={exReply}
          onChange={(e) => setExReply(e.target.value)}
        />
        <Button size="sm" className="mt-2" onClick={addExample} disabled={busy || !exReply.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Salvar exemplo
        </Button>
      </div>

      {/* Lista */}
      <div className="pt-2 border-t border-sidebar-border">
        <Label>O que ela já aprendeu ({lessons.length})</Label>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">Nada ainda. Ensine acima.</p>
        ) : (
          <ul className="space-y-2 mt-2">
            {lessons.map((l) => (
              <li key={l.id} className="flex items-start gap-2 p-2 rounded-md border border-sidebar-border">
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${l.kind === 'bad_example' ? 'bg-red-500/10 text-red-500' : l.kind === 'good_example' ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'}`}>
                  {LESSON_KIND_LABEL[l.kind]}
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  {l.context && <div className="text-xs text-muted-foreground truncate">Lead: {l.context}</div>}
                  <div className="break-words">{l.content}</div>
                </div>
                <button onClick={() => remove(l.id)} className="text-muted-foreground hover:text-red-500" title="Remover">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
