// Encaixes da página do card.
//
// Bloco "Próximas tarefas": a sessão de Tarefas publicou o TarefasDoLead; aqui
// ele vira o bloco da Ficha. A página não tem aba Tarefas (spec §5.3), então
// não há contagem a mostrar (sem `aoContar`).
import { Suspense, type ComponentType } from 'react';
import type { PipelineItem } from '@/types/analytics';
import { lazyWithRetry } from '@/utils/chunkReload';

export type BlocoDoCard = ComponentType<{ item: PipelineItem }>;

const TarefasDoLead = lazyWithRetry(() => import('@/features/tarefas/TarefasDoLead'));

export const BlocoDeTarefas: BlocoDoCard | null = ({ item }) => (
  <Suspense fallback={null}>
    <TarefasDoLead pipelineItemIds={[String(item.id)]} criarNoCard={String(item.id)} />
  </Suspense>
);
