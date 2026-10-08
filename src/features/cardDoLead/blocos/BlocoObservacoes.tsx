// src/features/cardDoLead/blocos/BlocoObservacoes.tsx
// Observações: o comentário que o corretor escolheu deixar. Separado do
// Histórico de propósito (decisão de 02/10).
import { MessageSquare } from 'lucide-react';
import CardNotesTab from '@/components/pipelines/CardNotesTab';

export default function BlocoObservacoes({ contactId }: { contactId: string | null }) {
  return (
    <div className="flex flex-col min-h-0 flex-1 rounded-xl border border-border p-4">
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 shrink-0">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        Observações
      </h4>
      <div className="flex-1 overflow-hidden min-h-0">
        <CardNotesTab contactId={contactId} />
      </div>
    </div>
  );
}
