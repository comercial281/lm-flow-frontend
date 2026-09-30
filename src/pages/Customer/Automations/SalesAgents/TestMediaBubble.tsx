import { FileText, Film, ImageIcon, Link2 } from 'lucide-react';
import type { TestMediaItem } from '@/services/salesAgents/salesAgentsService';
import SendToMeButton from './SendToMeButton';

// O que o lead REAL receberia. Aqui não há canal pra enviar, então em vez de a
// mídia sumir — deixando a IA parecer que prometeu "te mando as fotos" e não
// cumpriu — mostramos o que teria ido, com as fotos de verdade.
export default function TestMediaBubble({
  item, onSendToMe,
}: {
  item: TestMediaItem;
  /**
   * "Mandar pra mim": manda ESTA mídia pro WhatsApp do próprio dono. Só existe
   * quando o item tem `token` (o preview sabe qual mídia é) e é foto ou
   * arquivo — link e imagem de abertura não passam por aqui.
   */
  onSendToMe?: (item: TestMediaItem, phone: string) => Promise<string>;
}) {
  const canSendToMe = Boolean(onSendToMe) && Boolean(item.token) && (item.type === 'photos' || item.type === 'file');
  const sendToMeButton = canSendToMe ? (
    <SendToMeButton onSend={(phone) => onSendToMe!(item, phone)} />
  ) : null;

  // O pacote de fotos do imóvel (até 5), na ordem em que iriam. É aqui que o dono
  // confere, imóvel por imóvel, se as primeiras da galeria são as certas.
  if (item.type === 'photos') {
    const urls = item.urls ?? [];
    return (
      <div className="max-w-[80%] rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
        <div className="grid grid-cols-3 gap-0.5">
          {urls.map((u, i) => (
            <img key={`${i}-${u}`} src={u} alt={`Foto ${i + 1} do imóvel`} className="w-full h-20 object-cover" />
          ))}
        </div>
        <div className="px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
            <ImageIcon className="h-3 w-3" /> {urls.length} {urls.length === 1 ? 'foto enviada' : 'fotos enviadas'} no WhatsApp
          </div>
          {item.caption && <p className="text-xs text-muted-foreground whitespace-pre-line">{item.caption}</p>}
          {item.reason && <p className="text-[11px] text-muted-foreground italic">Por quê: {item.reason}</p>}
          {sendToMeButton}
        </div>
      </div>
    );
  }

  if (item.type === 'image') {
    return (
      <div className="max-w-[80%] rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
        <img src={item.url} alt="Foto do imóvel" className="w-full max-h-48 object-cover" />
        <div className="px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
            <ImageIcon className="h-3 w-3" /> Foto enviada no WhatsApp
          </div>
          {item.caption && <p className="text-xs text-muted-foreground whitespace-pre-line">{item.caption}</p>}
        </div>
      </div>
    );
  }

  // Arquivo (ou vídeo) que ela MANDARIA. O painel não envia nada — é aqui que dá
  // pra calibrar as regras de "quando enviar" sem gastar mensagem com lead de verdade.
  if (item.type === 'file') {
    const video = item.kind === 'video';
    return (
      <div className="max-w-[80%] rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium mb-0.5">
          {video ? <Film className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          {video ? 'Vídeo enviado no WhatsApp' : 'Arquivo enviado no WhatsApp'}
        </div>
        <div className="text-xs font-medium break-words">{item.title}</div>
        {item.caption && <p className="text-xs text-muted-foreground whitespace-pre-line">{item.caption}</p>}
        {item.reason && <p className="text-[11px] text-muted-foreground mt-1 italic">Por quê: {item.reason}</p>}
        {sendToMeButton}
      </div>
    );
  }

  return (
    <div className="max-w-[80%] rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium mb-0.5">
        <Link2 className="h-3 w-3" /> Link enviado no WhatsApp
      </div>
      <a href={item.url} target="_blank" rel="noreferrer" className="text-xs underline break-all">
        {item.url}
      </a>
    </div>
  );
}
