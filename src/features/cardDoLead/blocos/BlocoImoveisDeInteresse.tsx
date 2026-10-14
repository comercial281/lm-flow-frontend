// src/features/cardDoLead/blocos/BlocoImoveisDeInteresse.tsx
// Imóveis de interesse: busca no topo e cartões numa fileira que rola pro lado.
import { Suspense, useState } from 'react';
import { lazyWithRetry } from '@/utils/chunkReload';
import type { PipelineItem } from '@/types/analytics';
import { CaixaDaJanela } from '@/components/base/janela';
import Carregando from '@/components/base/Carregando';

const CardPropertyInterests = lazyWithRetry(() => import('@/components/pipelines/CardPropertyInterests'));

export default function BlocoImoveisDeInteresse({
  item, nomeExibido, onVisitaCriada,
}: { item: PipelineItem; nomeExibido?: string; onVisitaCriada?: () => void }) {
  const [total, setTotal] = useState<number | undefined>(undefined);
  return (
    <CaixaDaJanela titulo="Imóveis de interesse" contagem={total}>
      <Suspense fallback={<Carregando linhas={2} />}>
        <CardPropertyInterests item={item} nomeExibido={nomeExibido} onVisitaCriada={onVisitaCriada} aoContar={setTotal} />
      </Suspense>
    </CaixaDaJanela>
  );
}
