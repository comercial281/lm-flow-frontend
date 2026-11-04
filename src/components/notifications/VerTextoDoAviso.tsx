import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/ds';

/** O *negrito* do WhatsApp. Vira elemento, nunca HTML: o texto vem de fora da tela. */
function comNegrito(texto: string) {
  return texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
    /^\*[^*\n]+\*$/.test(parte) ? <strong key={i}>{parte.slice(1, -1)}</strong> : parte,
  );
}

/**
 * "Ver texto" de um aviso: a mensagem como chega no WhatsApp. O texto vem do servidor
 * (`whatsapp_preview` do catálogo), montado com o mesmo modelo do envio de verdade, então
 * a tela não tem texto próprio pra ficar diferente. Só leitura: o editor ainda não existe.
 */
export default function VerTextoDoAviso({ titulo, texto }: { titulo: string; texto?: string | null }) {
  const [aberto, setAberto] = useState(false);
  if (!texto) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-1 w-fit text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <MessageCircle className="w-3 h-3" />
        Ver texto
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>
              É assim que o aviso chega no WhatsApp. O nome e o link são de exemplo.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg bg-muted/40 border p-3 text-sm whitespace-pre-wrap break-words">
            {comNegrito(texto)}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
