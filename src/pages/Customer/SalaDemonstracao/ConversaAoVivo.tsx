// Conversa do lead com a IA, só leitura, em letra grande para a tela do Meet.
// Relê quando chega 'lmflow:realtime' (espera de 500 ms) e quando a tela pai
// mexe no refreshKey (a consulta de 3 s dela).
import { useCallback, useEffect, useRef, useState } from 'react';
import { conversationAPI } from '@/services/conversations/conversationService';
import { aplicarPaginaRecente, paginaDaResposta } from '@/components/pipelines/conversaDoCard';
import MessageImage from '@/components/chat/messages/MessageImage';
import MessageVideo from '@/components/chat/messages/MessageVideo';
import MessageFile from '@/components/chat/messages/MessageFile';
import MessageAudio from '@/components/chat/messages/MessageAudio';
import { MESSAGE_TYPE } from '@/types/chat/api';
import type { Attachment, Message } from '@/types/chat/api';

export interface ConversaAoVivoProps {
  conversationId: string | null;
  /** Muda a cada leitura da tela pai; cada mudança relê a conversa. */
  refreshKey?: number;
}

const ESPERA_DO_EVENTO_MS = 500;

function Anexos({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  switch (attachments[0]?.file_type) {
    case 'image': return <div className="mt-2"><MessageImage attachments={attachments} /></div>;
    case 'video': return <div className="mt-2"><MessageVideo attachments={attachments} /></div>;
    case 'audio': return <div className="mt-2"><MessageAudio attachments={attachments} /></div>;
    default: return <div className="mt-2"><MessageFile attachments={attachments} /></div>;
  }
}

export default function ConversaAoVivo({ conversationId, refreshKey = 0 }: ConversaAoVivoProps) {
  const [mensagens, setMensagens] = useState<Message[]>([]);
  const atual = useRef<string | null>(conversationId);
  const fim = useRef<HTMLDivElement>(null);

  const ler = useCallback(async () => {
    if (!conversationId) return;
    try {
      const pagina = paginaDaResposta(await conversationAPI.getMessages(conversationId));
      if (atual.current !== conversationId) return;
      setMensagens(anteriores => aplicarPaginaRecente(anteriores, pagina));
    } catch {
      // Releitura que falha mantém o que já está na tela.
    }
  }, [conversationId]);

  useEffect(() => {
    atual.current = conversationId;
    setMensagens([]);
  }, [conversationId]);

  useEffect(() => { void ler(); }, [ler, refreshKey]);

  useEffect(() => {
    if (!conversationId) return undefined;
    let espera: number | undefined;
    const aoVivo = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => { void ler(); }, ESPERA_DO_EVENTO_MS);
    };
    window.addEventListener('lmflow:realtime', aoVivo);
    return () => {
      window.clearTimeout(espera);
      window.removeEventListener('lmflow:realtime', aoVivo);
    };
  }, [conversationId, ler]);

  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: 'end' });
  }, [mensagens.length]);

  const visiveis = mensagens.filter(
    m => m.message_type === MESSAGE_TYPE.INCOMING || m.message_type === MESSAGE_TYPE.OUTGOING,
  );

  return (
    <section aria-label="Conversa ao vivo" data-testid="conversa-ao-vivo"
      className="max-h-[60vh] space-y-3 overflow-y-auto rounded-xl border bg-muted/30 p-4">
      {visiveis.length === 0 ? (
        <p className="py-8 text-center text-xl text-muted-foreground">
          A conversa aparece aqui assim que o lead escrever.
        </p>
      ) : visiveis.map(m => {
        const ia = m.message_type === MESSAGE_TYPE.OUTGOING;
        const anexos = m.attachments ?? [];
        return (
          <div key={m.id} data-lado={ia ? 'ia' : 'lead'} className={`flex ${ia ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${ia ? 'bg-primary text-primary-foreground' : 'border bg-card'}`}>
              {m.content && <p className="whitespace-pre-wrap break-words text-xl leading-snug">{m.content}</p>}
              <Anexos attachments={anexos} />
            </div>
          </div>
        );
      })}
      <div ref={fim} />
    </section>
  );
}
