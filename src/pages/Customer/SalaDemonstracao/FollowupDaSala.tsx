// Follow-up da Sala: linha do tempo dos passos do fluxo "só por chamada" e o
// botão que acelera a espera. Embaixo, três outros jeitos de fazer follow-up.
import { useEffect, useState } from 'react';
import { FileText, Image, MessageSquare, Mic, Video } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui/ds';
import { Aviso } from '@/components/base';
import { salesAgentsService } from '@/services/salesAgents/salesAgentsService';
import type { FollowupStep } from '@/types/demoRoom';

export interface ResultadoDoFollowup { ok: boolean; message: string }

export interface FollowupDaSalaProps {
  steps: FollowupStep[];
  onAgora: () => Promise<ResultadoDoFollowup | void> | ResultadoDoFollowup | void;
  /** IA da Sala: de onde vêm as horas da retomada (padrão 2 h e 8 h). */
  agentId?: string | null;
}

const PRIMEIRA_PADRAO = 2;
const SEGUNDA_PADRAO = 8;

function IconeDoTipo({ tipo }: { tipo: string }) {
  switch (tipo) {
    case 'audio': return <Mic className="h-4 w-4" aria-label="Áudio" />;
    case 'video': return <Video className="h-4 w-4" aria-label="Vídeo" />;
    case 'foto': case 'image': case 'imagem': return <Image className="h-4 w-4" aria-label="Foto" />;
    case 'book': case 'property_book': case 'document': case 'documento': return <FileText className="h-4 w-4" aria-label="Book" />;
    default: return <MessageSquare className="h-4 w-4" aria-label="Texto" />;
  }
}

// Passo sem texto (só mídia) diz o que é pelo tipo.
const PREVIEW_DO_TIPO: Record<string, string> = {
  audio: 'Áudio gravado',
  video: 'Vídeo do empreendimento',
  property_book: 'Book do imóvel', book: 'Book do imóvel', document: 'Book do imóvel', documento: 'Book do imóvel',
  image: 'Foto', imagem: 'Foto', foto: 'Foto',
};

function previewDoPasso(p: FollowupStep): string {
  if (p.preview?.trim()) return p.preview;
  const tipo = (p.kinds ?? []).find(k => PREVIEW_DO_TIPO[k]);
  return tipo ? PREVIEW_DO_TIPO[tipo] : 'Mensagem';
}

/** "1 dia depois" vira "1 dia depois na vida real"; "na hora" vira "Na hora". */
function esperaDoPasso(realDelay: string | null | undefined): string {
  const d = (realDelay ?? '').trim();
  if (!d) return '';
  if (d === 'na hora') return 'Na hora';
  return `${d} na vida real`;
}

const SELO: Record<FollowupStep['status'], string | null> = { enviado: 'Enviado', proximo: 'Próximo', depois: null };

export default function FollowupDaSala({ steps, onAgora, agentId }: FollowupDaSalaProps) {
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDoFollowup | null>(null);
  const [horas, setHoras] = useState({ primeira: PRIMEIRA_PADRAO, segunda: SEGUNDA_PADRAO });

  useEffect(() => {
    if (!agentId) return undefined;
    let vivo = true;
    void salesAgentsService.list().then(lista => {
      const a = lista.find(x => x.id === agentId);
      if (!vivo || !a) return;
      setHoras({
        primeira: a.reengagement_first_hours || PRIMEIRA_PADRAO,
        segunda: a.reengagement_second_hours || SEGUNDA_PADRAO,
      });
    }).catch(() => { /* mantém 2 h e 8 h */ });
    return () => { vivo = false; };
  }, [agentId]);

  const simular = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await onAgora();
      if (r) setResultado(r);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section aria-label="Follow-up" data-testid="followup-da-sala" className="space-y-4">
      <h2 className="text-xl font-semibold">Follow-up</h2>
      <Card className="p-5 space-y-4">
        <ol className="space-y-3">
          {steps.map(p => (
            <li key={p.step} className="flex items-start gap-3">
              <span className="mt-1 flex gap-1 text-muted-foreground">
                {((p.kinds ?? []).filter(k => k !== 'delay').length ? (p.kinds ?? []).filter(k => k !== 'delay') : ['texto']).map(k => <IconeDoTipo key={k} tipo={k} />)}
              </span>
              <div className="flex-1">
                <p className="text-lg">{previewDoPasso(p)}</p>
                {esperaDoPasso(p.real_delay) && <p className="text-sm text-muted-foreground">{esperaDoPasso(p.real_delay)}</p>}
              </div>
              {SELO[p.status] && (
                <Badge variant={p.status === 'enviado' ? 'default' : 'outline'}>{SELO[p.status]}</Badge>
              )}
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          Na vida real, o follow-up para quando o lead responde. Aqui ele segue pra você ver todos os formatos.
        </p>
        <Button onClick={() => void simular()} disabled={enviando}>Simular que o lead sumiu</Button>
        {resultado && <Aviso tom="info">{resultado.message}</Aviso>}
      </Card>

      <h3 className="text-lg font-semibold">Outros jeitos de fazer follow-up</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 space-y-2">
          <p className="font-semibold">Retomada escrita pela IA na hora</p>
          <p className="text-sm text-muted-foreground">
            Se o lead some, a IA escreve uma mensagem nova, sob medida pra conversa, {horas.primeira} h e {horas.segunda} h depois da última mensagem.
          </p>
          <p className="text-sm italic">Maria, vi que você ficou de olhar a planta. Quer que eu mande de novo?</p>
        </Card>
        <Card className="p-4 space-y-2">
          <p className="font-semibold">Follow-up que anda pela coluna do funil</p>
          <p className="text-sm text-muted-foreground">
            Cada coluna do funil tem a sua sequência. Quando o lead muda de coluna, a mensagem muda junto.
          </p>
          <p className="text-sm italic">Maria, sua visita é amanhã. Te espero às 10h, pode confirmar?</p>
        </Card>
        <Card className="p-4 space-y-2">
          <p className="font-semibold">Follow-up do corretor com a própria voz</p>
          <p className="text-sm text-muted-foreground">
            A mensagem sai com o jeito de falar do corretor, como se ele mesmo tivesse escrito.
          </p>
          <p className="text-sm italic">Oi Maria, aqui é o Carlos. Separei duas opções que cabem na sua parcela.</p>
        </Card>
      </div>
    </section>
  );
}
