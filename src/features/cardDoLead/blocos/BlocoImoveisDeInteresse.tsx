// src/features/cardDoLead/blocos/BlocoImoveisDeInteresse.tsx
// Imóveis de interesse (rola por dentro, ~3 imóveis).
import { Suspense } from 'react';
import { lazyWithRetry } from '@/utils/chunkReload';
import type { PipelineItem } from '@/types/analytics';
import CaixaDoCard from './CaixaDoCard';

const CardPropertyInterests = lazyWithRetry(() => import('@/components/pipelines/CardPropertyInterests'));

export default function BlocoImoveisDeInteresse({ item }: { item: PipelineItem }) {
  return (
    <CaixaDoCard titulo="Imóveis de interesse">
      <Suspense fallback={null}>
        <CardPropertyInterests item={item} />
      </Suspense>
    </CaixaDoCard>
  );
}
