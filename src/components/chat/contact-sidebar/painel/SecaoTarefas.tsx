import { useMemo, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { Button } from '@evoapi/design-system/button';
import TarefasDoLead from '@/features/tarefas/TarefasDoLead';
import { TEXTOS_DE_TAREFAS as T } from '@/features/tarefas/textos';
import { TEXTOS_DO_PAINEL } from '@/features/conversas/painelDoLead';
import PipelineManagement from '../PipelineManagement';
import Secao from './Secao';
import type { Pipeline } from '@/types/analytics';

interface Props {
  conversationId: string;
  /** Os funis desta conversa, os mesmos da seção Funil. */
  pipelines: Pipeline[];
  carregando: boolean;
  onAtualizado: () => void;
}

/**
 * Tarefas do lead na Conversa (Frente 2, 07/10/2026). É aqui que o corretor da
 * Moeda Forte, onde WhatsApp orgânico não vira card sozinho, cria tarefa: sem
 * card, a seção oferece "Colocar no funil" (pela conversa, então a origem do
 * lead sai certa) e abre a tarefa nova assim que o card nasce.
 * A tarefa nova vai pro card do primeiro funil da seção Funil.
 */
export default function SecaoTarefas({ conversationId, pipelines, carregando, onAtualizado }: Props) {
  const [colocando, setColocando] = useState(false);
  const [abrirNova, setAbrirNova] = useState(false);
  const cards = useMemo(
    () => pipelines.flatMap(p => (p.stages ?? []).flatMap(s => (s.items ?? []).map(i => String(i.id)))),
    [pipelines],
  );

  if (carregando && cards.length === 0) return null;

  return (
    <Secao titulo={T.titulo} icone={{ Icone: ListTodo, tom: 'laranja' }}>
      {cards.length > 0 ? (
        <TarefasDoLead pipelineItemIds={cards} criarNoCard={cards[0]} abrirNovaAgora={abrirNova} aoAbrirNova={() => setAbrirNova(false)} />
      ) : colocando ? (
        <PipelineManagement
          conversationId={conversationId}
          pipelines={pipelines}
          onPipelineUpdated={() => {
            setColocando(false);
            setAbrirNova(true);
            onAtualizado();
          }}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{T.semCard}</p>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setColocando(true)}>
            {TEXTOS_DO_PAINEL.colocarNoFunil}
          </Button>
        </div>
      )}
    </Secao>
  );
}
