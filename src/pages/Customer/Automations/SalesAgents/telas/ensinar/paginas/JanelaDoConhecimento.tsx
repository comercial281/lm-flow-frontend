// Ensinar · Conhecimentos de fábrica: "Ler o texto". SÓ LEITURA (pedido do Tony, 31/10): o cliente lê e desliga,
// nunca edita. O texto é o mesmo pra todos os clientes (mora em `global_knowledge_documents`, no public).
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import { data } from '@/lib/formato';
import type { ConhecimentoDeFabrica } from '@/services/salesAgents/salesAgentsService';

export function peDoConhecimento(reviewedAt: string | null): string {
  const quando = reviewedAt ? ` em ${data(reviewedAt)}` : '';
  return `Escrito pela Leal Mídia · conferido nas fontes oficiais${quando} · revisado a cada 180 dias · o documento da imobiliária vale mais.`;
}

export default function JanelaDoConhecimento({ item, aoFechar }: { item: ConhecimentoDeFabrica; aoFechar: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>O texto que a Leal Mídia escreveu pra ela. Você pode ligar e desligar, não editar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 whitespace-pre-wrap text-[15px] leading-relaxed">{item.body?.trim() || 'Sem texto cadastrado.'}</div>
        <p className="text-xs text-muted-foreground">{peDoConhecimento(item.reviewed_at)}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
