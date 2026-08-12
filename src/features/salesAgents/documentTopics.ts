/* ────────────────────────────────────────────────────────────────────────────
   Catálogo de assuntos do arquivo da IA Vendedora — fonte da verdade única.
   O backend guarda apenas os SLUGS (array jsonb `send_topics`); os rótulos vivem
   aqui, no mesmo formato do catálogo de características do imóvel
   (src/features/properties/amenities.ts).

   Pra que serve: o assunto entra no cérebro da IA junto com as regras escritas em
   português. "Planta" ajuda ela a casar o pedido do lead ("como são divididos os
   cômodos?") com o arquivo certo, mesmo quando as palavras não batem.

   Para adicionar/editar, mexa só neste arquivo. Nunca renomeie um `slug` já em uso
   (os arquivos guardam o slug) — troque só o `label`.
──────────────────────────────────────────────────────────────────────────── */

export interface DocumentTopic {
  slug: string;
  label: string;
}

export const DOCUMENT_TOPICS: DocumentTopic[] = [
  { slug: 'planta', label: 'Planta' },
  { slug: 'book', label: 'Book' },
  { slug: 'tabela_de_precos', label: 'Tabela de preços' },
  { slug: 'condicoes_de_pagamento', label: 'Condições de pagamento' },
  { slug: 'memorial_descritivo', label: 'Memorial descritivo' },
  { slug: 'ficha_tecnica', label: 'Ficha técnica' },
  { slug: 'regulamento', label: 'Regulamento' },
  { slug: 'documentacao', label: 'Documentação' },
  { slug: 'financiamento', label: 'Financiamento' },
  { slug: 'localizacao', label: 'Localização' },
  { slug: 'lazer', label: 'Lazer' },
  { slug: 'outro', label: 'Outro' },
];

export const topicLabel = (slug: string): string =>
  DOCUMENT_TOPICS.find((t) => t.slug === slug)?.label ?? slug;
